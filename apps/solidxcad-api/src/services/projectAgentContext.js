import { getObjectStream } from './s3.js';
import { fileRefForDoc } from './projectWorkspace.js';

const MAX_TEXT_CHARS = 12000;

import { deriveFriendlyFileBase, resolveNextVersionedBase } from './fileNaming.js';

export function baseNameFromFileName(name = '') {
  return String(name).replace(/\.[^.]+$/, '');
}

export function resolvePipelineOutputBase({
  userMessage = '',
  focusedFiles = [],
  projectFiles = [],
  skill = 'cad',
  isAssembly = false,
  modifyIntent = false,
  storageFolder = 'models',
} = {}) {
  const pickVersioned = (base) => (
    modifyIntent
      ? resolveNextVersionedBase(base, projectFiles, storageFolder)
      : base
  );

  for (const file of focusedFiles) {
    const base = baseNameFromFileName(file.name);
    if (/\.(step|stp|stl|glb|urdf|srdf|sdf|implicit\.js|py)$/i.test(file.name) || modifyIntent) {
      return pickVersioned(base);
    }
  }

  if (modifyIntent) {
    const latestStep = [...projectFiles]
      .filter((f) => /\.(step|stp)$/i.test(f.name) && String(f.s3Key || '').includes(`/${storageFolder}/`))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];
    if (latestStep) {
      return pickVersioned(baseNameFromFileName(latestStep.name));
    }
  }

  return deriveFriendlyFileBase(userMessage, { skill, isAssembly });
}

export function findCompanionScript(files = [], artifactFile) {
  if (!artifactFile) return null;
  const base = baseNameFromFileName(artifactFile.name);
  return files.find(
    (f) => f.name === `${base}.py` && /\/(models|assemblies)\//.test(f.s3Key || ''),
  ) || null;
}

async function loadFileText(file, maxChars = MAX_TEXT_CHARS) {
  if (!file?.s3Key) return null;
  try {
    const stream = await getObjectStream(file.s3Key);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').slice(0, maxChars);
  } catch {
    return null;
  }
}

function fenceForFile(name, content) {
  if (/\.py$/i.test(name)) return `\`\`\`python\n${content}\n\`\`\``;
  if (/\.implicit\.js$/i.test(name)) return `\`\`\`javascript\n${content}\n\`\`\``;
  if (/\.(urdf|srdf|sdf)$/i.test(name)) return `\`\`\`xml\n${content}\n\`\`\``;
  return `\`\`\`\n${content}\n\`\`\``;
}

export async function loadProjectScriptContents(files = []) {
  const pyFiles = files
    .filter((f) => f.name?.endsWith('.py') && f.s3Key?.includes('/models/'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const out = [];
  for (const file of pyFiles.slice(0, 3)) {
    const code = await loadFileText(file);
    if (code) out.push({ name: file.name, ref: fileRefForDoc(file), code });
  }
  return out;
}

export function groupProjectFiles(files = []) {
  const groups = { models: [], assemblies: [], parts: [], slices: [], other: [] };
  for (const f of files) {
    const key = f.s3Key || '';
    if (key.includes('/slices/')) groups.slices.push(f);
    else if (key.includes('/parts/')) groups.parts.push(f);
    else if (key.includes('/assemblies/')) groups.assemblies.push(f);
    else if (key.includes('/models/')) groups.models.push(f);
    else groups.other.push(f);
  }
  return groups;
}

export function wantsModifyExisting(text = '') {
  return /\b(change|modify|update|edit|resize|adjust|make it|add\s+(?:\d+\s*)?(?:\w+\s+)?holes?|remove|bigger|smaller|thicker|thinner|longer|shorter|redo|revise|iterate|version\s*2|tweak|fix|improve|fillet|chamfer|drill|pocket|cut)\b/i.test(text);
}

export async function buildFocusedFileContext(files = [], fileIds = []) {
  if (!fileIds?.length) return '';
  const idSet = new Set(fileIds.map(String));
  const selected = files.filter((f) => idSet.has(String(f._id)));
  if (!selected.length) return '';

  const lines = [
    '\n\n## User @-referenced files (update these — pipeline saves a new versioned basename)',
    'When modifying: edit the generator script from the source design; output uses _updated then _1, _2, …',
  ];

  const seen = new Set();
  for (const file of selected) {
    const companions = findCompanionScript(files, file);
    const toLoad = [file];
    if (companions && !selected.some((f) => String(f._id) === String(companions._id))) {
      toLoad.push(companions);
    }

    for (const f of toLoad) {
      if (seen.has(String(f._id))) continue;
      seen.add(String(f._id));

      lines.push(`\n### ${f.name} (${f.kind || 'file'}) — ref: ${fileRefForDoc(f)}`);
      const text = await loadFileText(f);
      if (text && /\.(py|urdf|srdf|sdf|implicit\.js)$/i.test(f.name)) {
        lines.push(fenceForFile(f.name, text));
      } else if (text && /\.(step|stp)$/i.test(f.name)) {
        lines.push('(STEP geometry on disk — edit the paired .py script to change this part.)');
      } else if (!text) {
        lines.push('(file stored — regenerate from user intent if unreadable)');
      } else {
        lines.push(`Path ref: ${fileRefForDoc(f)}`);
      }
    }
  }
  return lines.join('\n');
}

export async function buildRichProjectContext(files = []) {
  if (!files.length) return '';

  const grouped = groupProjectFiles(files);
  const lines = ['\n\n## Project workspace (browse before designing)'];

  for (const [folder, list] of Object.entries(grouped)) {
    if (!list.length) continue;
    lines.push(`\n### ${folder}/`);
    for (const f of list) {
      lines.push(`- ${f.name} (${f.kind || 'file'})`);
    }
  }

  const scripts = await loadProjectScriptContents(files);
  if (scripts.length) {
    lines.push('\n### Existing generator scripts (edit these when user asks to modify the model)');
    for (const s of scripts) {
      lines.push(`\n#### ${s.name}\n\`\`\`python\n${s.code}\n\`\`\``);
    }
  }

  lines.push(`
Workspace folders: models/ (single parts), assemblies/ (multi-part compounds), parts/ (catalog STEP imports), slices/ (G-code).
Use descriptive basenames from the design (e.g. 30mm_cube_m3_holes, mount_plate_assembly) — never random timestamps.
When user modifies an existing design: update the matching .py / generator script; pipeline writes a new versioned basename (_updated, then _1, _2).
For new designs: output complete runnable code in the same turn with [AGENT_PHASE: execute].
Physics: use realistic proportions, joint limits, masses/inertias for robots, structural sizing for frames, and standard units (mm for CAD, meters for URDF/SDF unless stated).
For assemblies: import_step("parts/…") only when user names specific hardware; otherwise model simplified geometry.
Compound children must be shapes only — never None, tuples, or raw lists.`);

  return lines.join('\n');
}

export async function loadLatestProjectUrdf(files = []) {
  const urdf = files
    .filter((f) => /\.urdf$/i.test(f.name) && f.s3Key?.includes('/models/'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  if (!urdf) return '';
  return (await loadFileText(urdf, 16000)) || '';
}
