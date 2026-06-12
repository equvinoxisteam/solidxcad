/**
 * Shared runner for Python generator skills: urdf, srdf, sdf.
 */
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config.js';
import { extractPythonCode } from './openrouter.js';
import { buildS3Key, uploadFile } from './s3.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { skillMeta } from './skillRegistry.js';

const GENERATOR_SKILLS = {
  urdf: {
    skillDir: 'urdf',
    module: 'urdf',
    genFn: 'gen_urdf',
    ext: 'urdf',
    kind: 'urdf',
    mime: 'application/xml',
    xmlRoot: 'robot',
  },
  srdf: {
    skillDir: 'srdf',
    module: 'srdf',
    genFn: 'gen_srdf',
    ext: 'srdf',
    kind: 'srdf',
    mime: 'application/xml',
    xmlRoot: 'robot',
  },
  sdf: {
    skillDir: 'sdf',
    module: 'sdf',
    genFn: 'gen_sdf',
    ext: 'sdf',
    kind: 'sdf',
    mime: 'application/xml',
    xmlRoot: 'sdf',
  },
};

async function findPython() {
  if (config.pythonBin) return config.pythonBin;
  return path.join(config.textToCadRoot, '.venv', 'Scripts', 'python.exe');
}

function scriptsDir(skillId) {
  const cfg = GENERATOR_SKILLS[skillId];
  return path.join(config.textToCadRoot, 'skills', cfg.skillDir, 'scripts');
}

function pythonEnv(skillId) {
  const scriptsDirPath = scriptsDir(skillId);
  const metaSrc = path.join(scriptsDirPath, 'packages', 'cadpy_metadata', 'src');
  const entries = [scriptsDirPath, metaSrc, process.env.PYTHONPATH].filter(Boolean);
  return { ...process.env, PYTHONPATH: entries.join(path.delimiter) };
}

function toPosixPath(filePath) {
  return path.resolve(filePath).split(path.sep).join('/');
}

function runGeneratorSkill(skillId, python, scriptPath, outputPath) {
  const cfg = GENERATOR_SKILLS[skillId];
  return new Promise((resolve, reject) => {
    const args = ['-m', cfg.module, scriptPath, '-o', toPosixPath(outputPath)];
    const child = spawn(python, args, {
      cwd: scriptsDir(skillId),
      env: pythonEnv(skillId),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout).trim().slice(-500) || `${cfg.module} exited ${code}`));
    });
  });
}

function sanitizeUrdfPlaceholders(xml) {
  return xml.replace(/\{[^}]+\}/g, (token) => {
    const lower = token.toLowerCase();
    if (lower.includes('length') || lower.includes('radius') || lower.includes('size')) return '0.1';
    if (lower.includes('mass')) return '0.5';
    return '0';
  });
}

function wrapXmlFragment(body, rootTag, robotName = 'generated_robot') {
  const cleaned = sanitizeUrdfPlaceholders(body.trim());
  const re = new RegExp(`<${rootTag}[\\s\\S]*<\\/${rootTag}>`, 'i');
  const match = cleaned.match(re);
  if (match) return match[0];
  return `<${rootTag} name="${robotName}">\n  ${cleaned}\n</${rootTag}>`;
}

function wrapRawXml(xml, genFn, rootTag) {
  const payload = wrapXmlFragment(xml, rootTag).replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'");
  return `import xml.etree.ElementTree as ET

def ${genFn}():
    return ET.fromstring('''${payload}''')
`;
}

export function hasGeneratorPayload(text = '', skillId = 'urdf') {
  const cfg = GENERATOR_SKILLS[skillId];
  if (!cfg) return false;
  const fnRe = new RegExp(`def\\s+${cfg.genFn}\\s*\\(`, 'm');
  const rootRe = new RegExp(`<${cfg.xmlRoot}[\\s>]`, 'i');
  return fnRe.test(text)
    || rootRe.test(text)
    || (skillId === 'urdf' && /<link[\s>]/i.test(text) && /<joint[\s>]/i.test(text));
}

export function extractGeneratorSource(text, skillId = 'urdf') {
  const cfg = GENERATOR_SKILLS[skillId];
  const fnRe = new RegExp(`def\\s+${cfg.genFn}\\s*\\(`, 'm');
  const rootRe = new RegExp(`<${cfg.xmlRoot}[\\s>]`, 'i');

  const blocks = [...text.matchAll(/```(?:python|xml|urdf|srdf|sdf)?\s*([\s\S]*?)```/gi)];
  for (const match of blocks) {
    const code = match[1].trim();
    if (fnRe.test(code)) return code;
  }
  for (const match of blocks) {
    const code = match[1].trim();
    if (rootRe.test(code) || (skillId === 'urdf' && /<link[\s>]/i.test(code))) {
      return wrapRawXml(code, cfg.genFn, cfg.xmlRoot);
    }
    if (/ET\.Element\s*\(/i.test(code)) return code;
  }
  for (const match of blocks) {
    const code = match[1].trim();
    if (/import |def /m.test(code)) return code;
  }

  const inline = text.match(new RegExp(`<${cfg.xmlRoot}[\\s\\S]*<\\/${cfg.xmlRoot}>`, 'i'));
  if (inline) return wrapRawXml(inline[0], cfg.genFn, cfg.xmlRoot);

  if (skillId === 'urdf') {
    const elements = [];
    for (const match of text.matchAll(/<(?:link|joint)\b[\s\S]*?<\/(?:link|joint)>/gi)) {
      elements.push(match[0].trim());
    }
    if (elements.length) return wrapRawXml(elements.join('\n  '), cfg.genFn, cfg.xmlRoot);
  }

  return extractPythonCode(text);
}

function ensureGenFn(code, skillId) {
  const cfg = GENERATOR_SKILLS[skillId];
  const fnRe = new RegExp(`def\\s+${cfg.genFn}\\s*\\(`, 'm');
  let out = code.trim();
  if (!fnRe.test(out)) {
    if (new RegExp(`<${cfg.xmlRoot}[\\s>]`, 'i').test(out)) return wrapRawXml(out, cfg.genFn, cfg.xmlRoot);
    throw new Error(`Response must define ${cfg.genFn}() or valid ${cfg.ext.toUpperCase()} XML`);
  }
  if (!/import xml\.etree/i.test(out)) {
    out = `import xml.etree.ElementTree as ET\n\n${out}`;
  }
  return out;
}

export async function executeGeneratorSkill({
  skillId,
  userId,
  projectId,
  assistantText,
  outputBaseName,
  onProgress = () => {},
}) {
  const cfg = GENERATOR_SKILLS[skillId];
  if (!cfg) throw new Error(`Unknown generator skill: ${skillId}`);

  const meta = skillMeta(skillId);
  onProgress(`Skill: ${meta.label} (${meta.dir})`);

  let pythonCode = extractGeneratorSource(assistantText, skillId);
  if (!pythonCode) {
    return { ok: false, skill: skillId, error: `No ${cfg.ext.toUpperCase()} code in AI response` };
  }

  try {
    pythonCode = ensureGenFn(pythonCode, skillId);
  } catch (err) {
    return { ok: false, skill: skillId, error: err.message };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `solidxcad-${skillId}-`));
  const outName = `${outputBaseName}.${cfg.ext}`;
  const scriptName = `${outputBaseName}.py`;
  const scriptPath = path.join(workDir, scriptName);
  const outPath = path.join(workDir, outName);
  const python = await findPython();

  try {
    onProgress(`Running skills/${cfg.skillDir} via ${path.basename(python)}…`);
    await fs.writeFile(scriptPath, pythonCode, 'utf8');
    await runGeneratorSkill(skillId, python, scriptPath, outPath);

    const outKey = buildS3Key(userId, projectId, `models/${outName}`);
    const outUpload = await uploadFile(outKey, outPath, cfg.mime);
    const scriptKey = buildS3Key(userId, projectId, `models/${scriptName}`);
    const scriptUpload = await uploadFile(scriptKey, scriptPath, 'text/x-python');

    const fileDoc = await ProjectFile.create({
      projectId,
      userId,
      name: outName,
      s3Key: outUpload.key,
      mimeType: cfg.mime,
      kind: cfg.kind,
    });

    await ProjectFile.create({
      projectId,
      userId,
      name: scriptName,
      s3Key: scriptUpload.key,
      mimeType: 'text/x-python',
      kind: 'other',
    });

    onProgress(`Saved ${outName} — open CAD Viewer`);

    try {
      const { syncProjectWorkspace } = await import('./projectWorkspace.js');
      await syncProjectWorkspace({ userId, projectId });
    } catch (syncErr) {
      console.warn(`[${skillId}] workspace sync:`, syncErr.message);
    }

    return {
      ok: true,
      skill: skillId,
      file: fileDoc,
      url: outUpload.url,
      s3Key: outUpload.key,
    };
  } catch (err) {
    return { ok: false, skill: skillId, error: err.message };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
