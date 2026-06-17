import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { buildS3Key, uploadFile, getObjectStream } from './s3.js';
import { fileRefForDoc, projectWorkspaceDir, storageFolderForFile, stepGlbRelCandidates } from './projectWorkspace.js';

async function findPython() {
  if (config.pythonBin) return config.pythonBin;
  const candidates = [
    path.join(config.textToCadRoot, '.venv', 'bin', 'python'),
    path.join(config.textToCadRoot, '.venv', 'Scripts', 'python.exe'),
    'python3',
    'python',
  ];
  for (const bin of candidates) {
    try {
      await fs.access(bin);
      return bin;
    } catch {
      if (!bin.includes('/') && !bin.includes('\\')) return bin;
    }
  }
  return 'python';
}

function inlineGlbPathForStep(stepPath) {
  return path.join(path.dirname(stepPath), `.${path.basename(stepPath)}.glb`);
}

function cadpyEnv() {
  const pythonPath = [
    path.join(config.textToCadRoot, 'packages', 'cadpy', 'src'),
    path.join(config.textToCadRoot, 'packages', 'cadpy_metadata', 'src'),
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter);
  return { ...process.env, PYTHONPATH: pythonPath };
}

async function runStepArtifact({ repoRoot, stepPath }) {
  const python = await findPython();
  const args = [
    '-m', 'cadpy.step_artifact',
    '--repo-root', path.resolve(repoRoot),
    '--step', path.resolve(stepPath),
    '--force',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: path.resolve(repoRoot),
      env: cadpyEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      const lastJson = stdout.trim().split(/\r?\n/).reverse().find((line) => line.trim().startsWith('{'));
      if (code === 0 && lastJson) {
        try {
          resolve(JSON.parse(lastJson));
          return;
        } catch {
          // fall through
        }
      }
      reject(new Error((stderr || stdout || `cadpy.step_artifact exited ${code}`).trim().slice(-500)));
    });
  });
}

function runPython(scriptPath, cwd) {
  return new Promise((resolve, reject) => {
    findPython().then((python) => {
      const child = spawn(python, [scriptPath], { cwd, env: { ...process.env }, shell: false });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || 'STL export failed'));
      });
    }).catch(reject);
  });
}

export async function exportStlFromStep(stepPath, stlPath) {
  const workDir = path.dirname(stepPath);
  const scriptPath = path.join(workDir, '_export_stl.py');
  const escapedStep = stepPath.replace(/\\/g, '\\\\');
  const escapedStl = stlPath.replace(/\\/g, '\\\\');

  const script = `from build123d import import_step, export_stl
part = import_step(r"${escapedStep}")
export_stl(part, r"${escapedStl}")
`;
  await fs.writeFile(scriptPath, script, 'utf8');
  await runPython(scriptPath, workDir);
  await fs.rm(scriptPath, { force: true });
}

export async function ensureMeshSidecar({ userId, projectId, stepFileDoc, stepLocalPath }) {
  const base = path.basename(stepFileDoc.name, path.extname(stepFileDoc.name));
  const stlName = `${base}.stl`;
  const existing = await ProjectFile.findOne({
    projectId,
    userId,
    name: stlName,
    kind: 'stl',
  });
  if (existing) return existing;

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-stl-'));
  const localStep = stepLocalPath || path.join(workDir, stepFileDoc.name);
  const localStl = path.join(workDir, stlName);

  try {
    if (!stepLocalPath) {
      const { getObjectStream } = await import('./s3.js');
      const { createWriteStream } = await import('fs');
      const { pipeline } = await import('stream/promises');
      await pipeline(await getObjectStream(stepFileDoc.s3Key), createWriteStream(localStep));
    }

    await exportStlFromStep(localStep, localStl);

    const stlFolder = storageFolderForFile(stepFileDoc);
    const stlKey = buildS3Key(userId, projectId, `${stlFolder}/${stlName}`);
    const stlUpload = await uploadFile(stlKey, localStl, 'model/stl');

    return ProjectFile.create({
      projectId,
      userId,
      name: stlName,
      s3Key: stlUpload.key,
      mimeType: 'model/stl',
      kind: 'stl',
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function generateGlbOnDisk(workspaceRoot, stepPath, onProgress = () => {}) {
  const glbPath = inlineGlbPathForStep(stepPath);
  try {
    await fs.access(glbPath);
    return glbPath;
  } catch {
    // generate below
  }

  onProgress('Generating GLB sidecar for CAD Viewer…');
  await runStepArtifact({ repoRoot: workspaceRoot, stepPath });
  await fs.access(glbPath);
  onProgress(`Saved ${path.basename(glbPath)} for viewer`);
  return glbPath;
}

export async function ensureGlbSidecar({
  userId,
  projectId,
  stepFileDoc,
  stepLocalPath,
  onProgress = () => {},
}) {
  const workspaceRoot = projectWorkspaceDir(userId, projectId);
  const rel = fileRefForDoc(stepFileDoc);
  const wsStep = path.join(workspaceRoot, rel);
  const glbPath = inlineGlbPathForStep(wsStep);
  const glbName = path.basename(glbPath);

  const existing = await ProjectFile.findOne({
    projectId,
    userId,
    name: glbName,
    kind: 'glb',
  });

  await fs.mkdir(path.dirname(wsStep), { recursive: true });
  if (stepLocalPath) {
    await fs.copyFile(stepLocalPath, wsStep);
  } else {
    try {
      await fs.access(wsStep);
    } catch {
      const { createWriteStream } = await import('fs');
      const { pipeline } = await import('stream/promises');
      await pipeline(await getObjectStream(stepFileDoc.s3Key), createWriteStream(wsStep));
    }
  }

  try {
    await generateGlbOnDisk(workspaceRoot, wsStep, onProgress);
  } catch (cadpyErr) {
    const projectFiles = await ProjectFile.find({ projectId, userId });
    const fileByRel = new Map(projectFiles.map((f) => [fileRefForDoc(f), f]));
    let plainGlbPath = '';
    for (const candidate of stepGlbRelCandidates(rel)) {
      const glbDoc = fileByRel.get(candidate);
      if (!glbDoc || glbDoc.kind !== 'glb') continue;
      const candidatePath = path.join(workspaceRoot, candidate);
      try {
        await fs.access(candidatePath);
        plainGlbPath = candidatePath;
        break;
      } catch {
        try {
          await fs.mkdir(path.dirname(candidatePath), { recursive: true });
          const { createWriteStream } = await import('fs');
          const { pipeline } = await import('stream/promises');
          await pipeline(await getObjectStream(glbDoc.s3Key), createWriteStream(candidatePath));
          plainGlbPath = candidatePath;
          break;
        } catch {
          // try next candidate
        }
      }
    }
    if (!plainGlbPath) {
      throw cadpyErr;
    }
    if (plainGlbPath !== glbPath) {
      await fs.copyFile(plainGlbPath, glbPath);
      onProgress(`Using existing ${path.basename(plainGlbPath)} as viewer GLB sidecar`);
    }
  }

  if (existing) return existing;

  try {
    const glbFolder = storageFolderForFile(stepFileDoc);
    const glbKey = buildS3Key(userId, projectId, `${glbFolder}/${glbName}`);
    const glbUpload = await uploadFile(glbKey, glbPath, 'model/gltf-binary');
    return ProjectFile.create({
      projectId,
      userId,
      name: glbName,
      s3Key: glbUpload.key,
      mimeType: 'model/gltf-binary',
      kind: 'glb',
    });
  } catch (err) {
    console.warn('[glb] metadata upload failed (viewer file is on disk):', err.message);
    return { name: glbName, kind: 'glb', onDisk: true };
  }
}

export async function ensureGlbSidecarsForSteps({ userId, projectId, files }) {
  const fileByRel = new Map(files.map((f) => [fileRefForDoc(f), f]));
  const out = [...files];

  for (const file of files) {
    if (file.kind !== 'step' && !/\.(step|stp)$/i.test(file.name)) continue;
    const rel = fileRefForDoc(file);
    const hasGlb = stepGlbRelCandidates(rel).some((candidate) => fileByRel.has(candidate));
    if (hasGlb) continue;
    try {
      const glbDoc = await ensureGlbSidecar({
        userId,
        projectId,
        stepFileDoc: file,
      });
      if (glbDoc?._id) {
        out.push(glbDoc);
        fileByRel.set(fileRefForDoc(glbDoc), glbDoc);
      }
    } catch (err) {
      console.warn(`[glb] sidecar for ${file.name}:`, err.message);
    }
  }

  return out;
}
