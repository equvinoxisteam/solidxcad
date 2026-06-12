import { getObjectStream } from './s3.js';
import { fileRefForDoc } from './projectWorkspace.js';

const MAX_PY_CHARS = 12000;

export async function loadProjectScriptContents(files = []) {
  const pyFiles = files
    .filter((f) => f.name?.endsWith('.py') && f.s3Key?.includes('/models/'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const out = [];
  for (const file of pyFiles.slice(0, 3)) {
    try {
      const stream = await getObjectStream(file.s3Key);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const code = Buffer.concat(chunks).toString('utf8').slice(0, MAX_PY_CHARS);
      out.push({ name: file.name, ref: fileRefForDoc(file), code });
    } catch {
      // skip unreadable
    }
  }
  return out;
}

export function groupProjectFiles(files = []) {
  const groups = { models: [], parts: [], slices: [], other: [] };
  for (const f of files) {
    const key = f.s3Key || '';
    if (key.includes('/slices/')) groups.slices.push(f);
    else if (key.includes('/parts/')) groups.parts.push(f);
    else if (key.includes('/models/')) groups.models.push(f);
    else groups.other.push(f);
  }
  return groups;
}

export function wantsModifyExisting(text = '') {
  return /\b(change|modify|update|edit|resize|adjust|make it|add\s+(a\s+)?hole|remove|bigger|smaller|thicker|thinner|longer|shorter|redo|revise|iterate|version\s*2)\b/i.test(text);
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
When user modifies an existing design: update the latest .py script logic, keep gen_step() returning one solid or a valid Compound with shape children only.
For assemblies: import_step("parts/…") for catalog parts; use Compound(label="assembly", children=[plate, screw1, …]) with real shapes only.
Never return None, tuples, or lists inside Compound children — fuse with + if needed.`);

  return lines.join('\n');
}
