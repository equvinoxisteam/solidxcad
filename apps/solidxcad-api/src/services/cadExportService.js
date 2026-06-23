import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { buildS3Key, uploadFile, storageObjectExists } from './s3.js';
import { ProjectFile } from '../models/ProjectFile.js';

export async function findPython() {
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

export function cadSkillScriptsDir() {
  return path.join(config.textToCadRoot, 'skills', 'cad', 'scripts');
}

export function implicitExportCli() {
  return path.join(config.textToCadRoot, 'skills', 'implicit-cad', 'scripts', 'export.mjs');
}

function cadSkillEnv() {
  const scriptsDir = cadSkillScriptsDir();
  const cadpySrc = path.join(scriptsDir, 'packages', 'cadpy', 'src');
  const metaSrc = path.join(scriptsDir, 'packages', 'cadpy_metadata', 'src');
  const entries = [scriptsDir, cadpySrc, metaSrc, process.env.PYTHONPATH].filter(Boolean);
  return { ...process.env, PYTHONPATH: entries.join(path.delimiter) };
}

export function spawnProcess(cmd, args, { cwd, env, timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: env || process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Process timed out: ${path.basename(cmd)}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${cmd} exited ${code}`).trim().slice(-600)));
    });
  });
}

export async function runCadStepFromScript({
  workDir,
  scriptName,
  stepName,
  sidecars = {},
  timeoutMs = 180000,
}) {
  const python = await findPython();
  const stepCli = path.join(cadSkillScriptsDir(), 'step');
  const args = [stepCli, scriptName, '-o', stepName];
  if (sidecars.stl) args.push('--stl', sidecars.stl);
  if (sidecars.threeMf) args.push('--3mf', sidecars.threeMf);
  if (sidecars.glb) args.push('--glb', sidecars.glb);
  await spawnProcess(python, args, { cwd: workDir, env: cadSkillEnv(), timeoutMs });
}

export async function exportSidecarsFromStep({
  workDir,
  stepName,
  baseName,
  sidecars = {},
}) {
  const python = await findPython();
  const stepCli = path.join(cadSkillScriptsDir(), 'step');
  const args = [stepCli, '--kind', 'part', stepName];
  if (sidecars.stl) args.push('--stl', `${baseName}.stl`);
  if (sidecars.threeMf) args.push('--3mf', `${baseName}.3mf`);
  if (sidecars.glb) args.push('--glb', `${baseName}.glb`);
  await spawnProcess(python, args, { cwd: workDir, env: cadSkillEnv() });
}

export async function exportDxfFromScript({ workDir, scriptName }) {
  const python = await findPython();
  const dxfCli = path.join(cadSkillScriptsDir(), 'dxf');
  await spawnProcess(python, [dxfCli, scriptName], { cwd: workDir, env: cadSkillEnv() });
  const dxfName = scriptName.replace(/\.py$/i, '.dxf');
  const dxfPath = path.join(workDir, dxfName);
  await fs.access(dxfPath);
  return dxfPath;
}

export async function exportImplicitFormat({ implicitPath, format, outputPath }) {
  const cli = implicitExportCli();
  await fs.access(cli);
  const args = [
    cli,
    '--input', implicitPath,
    '--format', format,
    '--output', outputPath,
    '--json',
  ];
  await spawnProcess(process.execPath, args, {
    cwd: path.dirname(implicitPath),
    timeoutMs: 300000,
  });
  await fs.access(outputPath);
  return outputPath;
}

export async function registerExportedFile({
  userId,
  projectId,
  name,
  localPath,
  mimeType,
  kind,
  storageFolder = 'models',
}) {
  const stat = await fs.stat(localPath);
  const existing = await ProjectFile.findOne({ projectId, userId, name, kind });
  if (existing && await storageObjectExists(existing.s3Key)) {
    return existing;
  }

  const folder = ['models', 'assemblies', 'parts', 'slices'].includes(storageFolder)
    ? storageFolder
    : 'models';
  const key = buildS3Key(userId, projectId, `${folder}/${name}`);
  const upload = await uploadFile(key, localPath, mimeType);
  if (existing) {
    existing.s3Key = upload.key;
    existing.mimeType = mimeType;
    existing.kind = kind;
    existing.sizeBytes = stat.size;
    await existing.save();
    return existing;
  }
  return ProjectFile.create({
    projectId,
    userId,
    name,
    s3Key: upload.key,
    mimeType,
    kind,
    sizeBytes: stat.size,
  });
}

const MIME_BY_EXT = {
  '.stl': 'model/stl',
  '.glb': 'model/gltf-binary',
  '.3mf': 'model/3mf',
  '.dxf': 'image/vnd.dxf',
};

const KIND_BY_EXT = {
  '.stl': 'stl',
  '.glb': 'glb',
  '.3mf': '3mf',
  '.dxf': 'dxf',
};

export async function uploadSidecarIfExists({
  userId,
  projectId,
  workDir,
  fileName,
  storageFolder = 'models',
  onProgress = () => {},
}) {
  const localPath = path.join(workDir, fileName);
  try {
    await fs.access(localPath);
  } catch {
    return null;
  }

  const ext = path.extname(fileName).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
  const kind = KIND_BY_EXT[ext] || 'other';
  onProgress(`Saving ${fileName}…`);
  const doc = await registerExportedFile({
    userId,
    projectId,
    name: fileName,
    localPath,
    mimeType,
    kind,
    storageFolder,
  });
  onProgress(`Saved ${fileName}`);
  return doc;
}
