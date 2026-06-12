import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config.js';
import { extractPythonCode } from './openrouter.js';
import { buildS3Key, uploadFile } from './s3.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { skillMeta } from './skillRegistry.js';

async function findPython() {
  if (config.pythonBin) return config.pythonBin;
  const candidates = [
    path.join(config.textToCadRoot, '.venv', 'Scripts', 'python.exe'),
    path.join(config.textToCadRoot, '.venv', 'bin', 'python'),
    'python',
    'python3',
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

function urdfScriptsDir() {
  return path.join(config.textToCadRoot, 'skills', 'urdf', 'scripts');
}

function urdfPythonEnv() {
  const scriptsDir = urdfScriptsDir();
  const metaSrc = path.join(scriptsDir, 'packages', 'cadpy_metadata', 'src');
  const entries = [scriptsDir, metaSrc, process.env.PYTHONPATH].filter(Boolean);
  return { ...process.env, PYTHONPATH: entries.join(path.delimiter) };
}

function toPosixPath(filePath) {
  return path.resolve(filePath).split(path.sep).join('/');
}

function runUrdfSkill(python, scriptPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'urdf', scriptPath, '-o', toPosixPath(outputPath)];
    const child = spawn(python, args, {
      cwd: urdfScriptsDir(),
      env: urdfPythonEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout).trim().slice(-500) || `URDF skill exited ${code}`));
    });
  });
}

export function hasUrdfPayload(text = '') {
  return /<robot[\s>]/i.test(text)
    || (/<link[\s>]/i.test(text) && /<joint[\s>]/i.test(text))
    || /def\s+gen_urdf\s*\(/m.test(text)
    || /ET\.Element\s*\(\s*['"]robot/i.test(text);
}

function sanitizeUrdfPlaceholders(xml) {
  return xml.replace(/\{[^}]+\}/g, (token) => {
    const lower = token.toLowerCase();
    if (lower.includes('length') || lower.includes('radius') || lower.includes('size')) return '0.1';
    if (lower.includes('mass')) return '0.5';
    return '0';
  });
}

function wrapUrdfFragment(body, robotName = 'generated_robot') {
  const cleaned = sanitizeUrdfPlaceholders(body.trim());
  if (/<robot[\s>]/i.test(cleaned)) {
    const robotMatch = cleaned.match(/<robot[\s\S]*<\/robot>/i);
    return robotMatch ? robotMatch[0] : cleaned;
  }
  return `<robot name="${robotName}">\n  ${cleaned}\n</robot>`;
}

function wrapRawUrdfXml(xml) {
  const payload = wrapUrdfFragment(xml).replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'");
  return `import xml.etree.ElementTree as ET

def gen_urdf():
    return ET.fromstring('''${payload}''')
`;
}

function extractUrdfElements(text) {
  const elements = [];
  for (const match of text.matchAll(/<(?:link|joint)\b[\s\S]*?<\/(?:link|joint)>/gi)) {
    elements.push(match[0].trim());
  }
  return elements;
}

function extractUrdfSource(text) {
  const blocks = [...text.matchAll(/```(?:python|xml|urdf)?\s*([\s\S]*?)```/gi)];
  for (const match of blocks) {
    const code = match[1].trim();
    if (/def\s+gen_urdf\s*\(/m.test(code)) return code;
  }
  for (const match of blocks) {
    const code = match[1].trim();
    if (/<robot[\s>]/i.test(code) || /<link[\s>]/i.test(code)) return wrapRawUrdfXml(code);
    if (/ET\.Element\s*\(\s*['"]robot/i.test(code)) return code;
  }
  for (const match of blocks) {
    const code = match[1].trim();
    if (/import |def /m.test(code)) return code;
  }

  const inlineRobot = text.match(/<robot[\s\S]*<\/robot>/i);
  if (inlineRobot) return wrapRawUrdfXml(inlineRobot[0]);

  const elements = extractUrdfElements(text);
  if (elements.length) return wrapRawUrdfXml(elements.join('\n  '));

  const python = extractPythonCode(text);
  if (python) return python;
  return null;
}

function ensureGenUrdf(code) {
  let out = code.trim();
  if (!/def\s+gen_urdf\s*\(/m.test(out)) {
    if (/<robot[\s>]/i.test(out)) {
      return wrapRawUrdfXml(out);
    }
    if (/xml\.etree\.ElementTree|ET\.Element\s*\(\s*['"]robot/i.test(out)) {
      out = `import xml.etree.ElementTree as ET\n\n${out}\n\nif 'gen_urdf' not in dir():\n    def gen_urdf():\n        return robot\n`;
    } else {
      throw new Error('URDF response must define gen_urdf() — ask again: "Create a simple 2-link robot arm URDF"');
    }
  }
  if (!/import xml\.etree\.ElementTree|import xml\.etree/i.test(out)) {
    out = `import xml.etree.ElementTree as ET\n\n${out}`;
  }
  return out;
}

export async function executeUrdfGeneration({
  userId,
  projectId,
  assistantText,
  robotName = 'robot',
  onProgress = () => {},
}) {
  const meta = skillMeta('urdf');
  onProgress(`Skill: ${meta.label} (${meta.dir})`);

  let pythonCode = extractUrdfSource(assistantText);
  if (!pythonCode) {
    return {
      ok: false,
      error: 'No URDF code in AI response. Ask: "Create a simple 2-link robot arm URDF"',
    };
  }

  try {
    pythonCode = ensureGenUrdf(pythonCode);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-urdf-'));
  const urdfName = `${robotName}.urdf`;
  const scriptName = `${path.basename(urdfName, '.urdf')}.py`;
  const scriptPath = path.join(workDir, scriptName);
  const urdfPath = path.join(workDir, urdfName);
  const python = await findPython();

  try {
    onProgress(`Running skills/urdf via ${path.basename(python)}…`);
    await fs.writeFile(scriptPath, pythonCode, 'utf8');
    await runUrdfSkill(python, scriptPath, urdfPath);

    const urdfKey = buildS3Key(userId, projectId, `models/${urdfName}`);
    const urdfUpload = await uploadFile(urdfKey, urdfPath, 'application/xml');

    const scriptKey = buildS3Key(userId, projectId, `models/${scriptName}`);
    const scriptUpload = await uploadFile(scriptKey, scriptPath, 'text/x-python');

    const fileDoc = await ProjectFile.create({
      projectId,
      userId,
      name: urdfName,
      s3Key: urdfUpload.key,
      mimeType: 'application/xml',
      kind: 'urdf',
    });

    await ProjectFile.create({
      projectId,
      userId,
      name: scriptName,
      s3Key: scriptUpload.key,
      mimeType: 'text/x-python',
      kind: 'other',
    });

    onProgress(`Saved ${urdfName} — open CAD Viewer tab`);

    try {
      const { syncProjectWorkspace } = await import('./projectWorkspace.js');
      await syncProjectWorkspace({ userId, projectId });
    } catch (syncErr) {
      console.warn('[urdf] workspace sync:', syncErr.message);
    }

    return {
      ok: true,
      skill: 'urdf',
      file: fileDoc,
      url: urdfUpload.url,
      s3Key: urdfUpload.key,
    };
  } catch (err) {
    return { ok: false, skill: 'urdf', error: err.message };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
