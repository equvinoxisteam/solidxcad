import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { Job } from '../models/Job.js';
import { buildS3Key, uploadFile } from './s3.js';
import { ensureMeshSidecar } from './artifactPipeline.js';
import { getObjectStream } from './s3.js';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { writeTempSliceProfile, defaultSliceSettings } from './sliceProfile.js';

function builtinSliceScript() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/mesh_slice.py');
}

function useBuiltinSlicer() {
  const mode = config.slicerBackend;
  if (mode === 'builtin') return true;
  if (mode === 'external') return false;
  const orcaBin = config.orcaSlicerBin || process.env.ORCASLICER_BIN || '';
  const prusaBin = config.prusaSlicerBin || process.env.PRUSASLICER_BIN || '';
  return !orcaBin && !prusaBin;
}

async function runBuiltinSlice(python, meshPath, outputPath, settings, workDir) {
  const scriptPath = builtinSliceScript();
  const settingsPath = path.join(workDir, 'slice-settings.json');
  await fs.writeFile(
    settingsPath,
    JSON.stringify({ ...defaultSliceSettings(), ...(settings || {}) }),
    'utf8',
  );
  await runProcess(
    python,
    [scriptPath, '--input', meshPath, '--output', outputPath, '--settings', settingsPath],
    workDir,
  );
}

const DEFAULT_PROFILE = {
  backend: 'auto',
  native_config: '',
  machine: {
    bed_size_mm: [220, 220],
    z_height_mm: 250,
  },
};

function slicerEnv() {
  const env = { ...process.env };
  if (config.orcaSlicerBin) env.ORCASLICER_BIN = config.orcaSlicerBin;
  if (config.prusaSlicerBin) env.PRUSASLICER_BIN = config.prusaSlicerBin;
  if (config.slicerProfilePath) env.SLICER_PROFILE_PATH = config.slicerProfilePath;
  return env;
}

function parseSliceToolError(stdout, stderr) {
  const blob = `${stdout || ''}\n${stderr || ''}`.trim();
  for (const line of blob.split('\n').reverse()) {
    const chunk = line.trim();
    if (!chunk.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(chunk);
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // try next line
    }
  }
  if (/Slic3r::CLI::run found error/i.test(blob)) {
    return 'OrcaSlicer could not slice this mesh';
  }
  const lines = blob.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const chunk = lines.slice(i).join('\n').trim();
    if (!chunk.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(chunk);
      if (typeof parsed.stdout_tail === 'string' && parsed.stdout_tail.trim()) {
        const tail = parsed.stdout_tail.trim();
        if (/Slic3r::CLI::run found error/i.test(tail)) return 'OrcaSlicer could not slice this mesh';
        return tail;
      }
      if (typeof parsed.stderr_tail === 'string' && parsed.stderr_tail.trim()) {
        return parsed.stderr_tail.trim();
      }
      if (parsed.returncode !== undefined && Number(parsed.returncode) !== 0) {
        return 'OrcaSlicer could not slice this mesh';
      }
    } catch {
      // try earlier chunk
    }
  }
  const tail = lines.filter((line) => line.trim() && !line.trim().startsWith('{')).pop();
  return tail?.trim() || 'Slicing failed';
}

async function runPythonScript(python, scriptPath, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [scriptPath], {
      cwd,
      env: slicerEnv(),
      shell: false,
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || 'Python script failed'));
    });
  });
}

async function exportBoundingBoxStl(python, meshPath, outStl) {
  const scriptPath = path.join(path.dirname(meshPath), '_bbox_export.py');
  const escIn = meshPath.replace(/\\/g, '\\\\');
  const escOut = outStl.replace(/\\/g, '\\\\');
  await fs.writeFile(scriptPath, `
try:
    import trimesh
    loaded = trimesh.load(r"${escIn}")
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        loaded = trimesh.util.concatenate(meshes) if meshes else loaded
    bounds = loaded.bounds
    extents = bounds[1] - bounds[0]
    center = (bounds[0] + bounds[1]) / 2
    box = trimesh.creation.box(extents=extents)
    box.apply_translation(center - box.centroid)
    box.export(r"${escOut}")
except Exception:
    from build123d import Box, export_stl
    export_stl(Box(30, 30, 30), r"${escOut}")
`, 'utf8');
  await runPythonScript(python, scriptPath, path.dirname(meshPath));
}

async function runSliceCommand(python, gcodeTool, meshPath, outputPath, profileArg, workDir) {
  const args = [
    gcodeTool,
    'slice',
    '--input', meshPath,
    '--output', outputPath,
    '--profile', profileArg,
    '--execute',
  ];
  await runProcess(python, args, workDir);
}

function runProcess(cmd, args, cwd, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: slicerEnv(),
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Slicing timed out after 5 minutes'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(parseSliceToolError(stdout, stderr)));
    });
  });
}

function safeGcodeName(meshFileName) {
  const base = path.basename(meshFileName, path.extname(meshFileName))
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'part';
  return `${base}.gcode`;
}

async function findPython() {
  const candidates = [
    config.pythonBin,
    '/opt/venv/bin/python',
    path.join(config.textToCadRoot, '.venv', 'bin', 'python'),
    path.join(config.textToCadRoot, '.venv', 'Scripts', 'python.exe'),
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      if (candidate === 'python3') return candidate;
    }
  }
  return 'python3';
}

async function downloadToTemp(fileDoc) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-slice-'));
  const ext = path.extname(fileDoc.name).toLowerCase() || '.stl';
  const safeName = `slice_input${ext}`;
  const dest = path.join(workDir, safeName);
  await pipeline(await getObjectStream(fileDoc.s3Key), createWriteStream(dest));
  return { workDir, meshPath: dest, sourceName: fileDoc.name };
}

function slicerProfilePath() {
  if (config.slicerProfilePath) return config.slicerProfilePath;
  return '';
}

export async function executeSliceJob({ userId, projectId, fileId, profilePath, settings }) {
  const job = await Job.create({
    userId,
    projectId,
    type: 'slice',
    status: 'running',
    input: { fileId, profilePath, settings },
    startedAt: new Date(),
  });

  let workDir = '';

  try {
    const source = await ProjectFile.findOne({ _id: fileId, projectId, userId });
    if (!source) throw new Error('Source file not found');

    let meshFile = source;
    if (source.kind === 'step' || source.name.endsWith('.step') || source.name.endsWith('.stp')) {
      console.log(`[slice] converting STEP → STL: ${source.name}`);
      meshFile = await ensureMeshSidecar({ userId, projectId, stepFileDoc: source });
    }

    const temp = await downloadToTemp(meshFile);
    workDir = temp.workDir;
    const { meshPath } = temp;
    const outputPath = path.join(workDir, 'slice_output.gcode');
    const python = await findPython();
    const mergedSettings = { ...defaultSliceSettings(), ...(settings || {}) };

    console.log(`[slice] slicing ${meshFile.name} → ${safeGcodeName(meshFile.name)}`);
    let usedBboxFallback = false;

    if (useBuiltinSlicer()) {
      console.log('[slice] using SolidX built-in mesh slicer');
      try {
        await runBuiltinSlice(python, meshPath, outputPath, mergedSettings, workDir);
      } catch (primaryErr) {
        console.warn('[slice] built-in mesh failed, trying bounding-box solid…', primaryErr.message);
        const bboxStl = path.join(workDir, 'slice_bbox.stl');
        await exportBoundingBoxStl(python, meshPath, bboxStl);
        await runBuiltinSlice(python, bboxStl, outputPath, mergedSettings, workDir);
        usedBboxFallback = true;
      }
    } else {
      const gcodeTool = path.join(config.textToCadRoot, 'skills', 'gcode', 'scripts', 'gcode_tool.py');
      const nativeConfig = profilePath || slicerProfilePath();
      let profileArg = nativeConfig;
      if (settings && Object.keys(settings).length > 0) {
        profileArg = await writeTempSliceProfile(workDir, settings);
      } else if (!nativeConfig) {
        profileArg = await writeTempSliceProfile(workDir, {});
      } else {
        try {
          await fs.access(nativeConfig);
        } catch {
          profileArg = await writeTempSliceProfile(workDir, {});
        }
      }

      const orcaBin = config.orcaSlicerBin || process.env.ORCASLICER_BIN || '';
      const prusaBin = config.prusaSlicerBin || process.env.PRUSASLICER_BIN || '';
      if (!orcaBin && !prusaBin) {
        throw new Error(
          'External slicer not configured. Set ORCASLICER_BIN or use SLICER_BACKEND=builtin.',
        );
      }

      try {
        await runSliceCommand(python, gcodeTool, meshPath, outputPath, profileArg, workDir);
      } catch (primaryErr) {
        console.warn('[slice] primary mesh failed, trying bounding-box solid…', primaryErr.message);
        const bboxStl = path.join(workDir, 'slice_bbox.stl');
        await exportBoundingBoxStl(python, meshPath, bboxStl);
        await runSliceCommand(python, gcodeTool, bboxStl, outputPath, profileArg, workDir);
        usedBboxFallback = true;
      }
    }

    let gcodePath = outputPath;
    try {
      await fs.access(gcodePath);
    } catch {
      const files = await fs.readdir(workDir);
      const gcode = files.find((f) => f.endsWith('.gcode'));
      if (!gcode) throw new Error('Slicer did not produce G-code output');
      gcodePath = path.join(workDir, gcode);
    }

    const gcodeName = safeGcodeName(meshFile.name);
    const gcodeKey = buildS3Key(userId, projectId, `slices/${gcodeName}`);
    const gcodeUpload = await uploadFile(gcodeKey, gcodePath, 'text/plain');

    const fileDoc = await ProjectFile.create({
      projectId,
      userId,
      name: gcodeName,
      s3Key: gcodeUpload.key,
      mimeType: 'text/plain',
      kind: 'gcode',
    });

    job.status = 'completed';
    job.output = {
      fileId: fileDoc._id.toString(),
      name: gcodeName,
      bboxFallback: usedBboxFallback,
    };
    job.completedAt = new Date();
    await job.save();

    console.log(`[slice] ✓ saved slices/${gcodeName}${usedBboxFallback ? ' (bounding-box fallback)' : ''}`);

    let bundleFiles = [];
    try {
      const { publishSliceCompanionMeshes } = await import('./sliceBundle.js');
      bundleFiles = await publishSliceCompanionMeshes({
        userId,
        projectId,
        meshFileName: meshFile.name,
      });
    } catch (bundleErr) {
      console.warn('[slice] print mesh bundle:', bundleErr.message);
    }

    try {
      const { syncProjectWorkspace } = await import('./projectWorkspace.js');
      await syncProjectWorkspace({ userId, projectId });
    } catch (syncErr) {
      console.warn('[slice] workspace sync:', syncErr.message);
    }

    return { ok: true, job, file: fileDoc, bundleFiles, bboxFallback: usedBboxFallback };
  } catch (err) {
    console.error('[slice] failed:', err.message);
    job.status = 'failed';
    job.error = err.message;
    job.completedAt = new Date();
    await job.save();
    return { ok: false, job, error: err.message };
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
