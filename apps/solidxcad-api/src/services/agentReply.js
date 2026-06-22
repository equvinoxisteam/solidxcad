import { stripAgentMarkers } from './agentBehavior.js';
import { USER_ERRORS } from './userFacingErrors.js';

const SKILL_SUMMARY = {
  cad: 'Solid model',
  urdf: 'Robot description (URDF)',
  srdf: 'MoveIt semantic groups (SRDF)',
  sdf: 'Simulation model (SDF)',
  'implicit-cad': 'Implicit CAD model',
  gcode: 'G-code toolpath',
  'step-parts': 'Catalog part',
  sendcutsend: 'Sheet-metal preflight',
};

function fileKindLabel(name = '', kind = '') {
  const n = String(name).toLowerCase();
  if (/\.(step|stp)$/.test(n)) return 'STEP geometry';
  if (/\.stl$/.test(n)) return 'STL mesh';
  if (/\.glb$/.test(n)) return 'GLB preview';
  if (/\.3mf$/.test(n)) return '3MF print package';
  if (/\.dxf$/.test(n)) return 'DXF drawing';
  if (/\.gcode$/.test(n)) return 'G-code toolpath';
  if (/\.urdf$/.test(n)) return 'URDF robot';
  if (/\.srdf$/.test(n)) return 'SRDF config';
  if (/\.sdf$/.test(n)) return 'SDF simulation';
  if (/\.implicit\.js$/.test(n)) return 'Implicit CAD';
  return kind || 'Design file';
}

function folderLabel(s3Key = '') {
  if (String(s3Key).includes('/assemblies/')) return 'assemblies';
  if (String(s3Key).includes('/parts/')) return 'parts';
  if (String(s3Key).includes('/slices/')) return 'slices';
  return 'models';
}

function stripFileReferencesFromReply(text = '') {
  let out = text;
  out = out.replace(
    /^Files?:\s*[`'"]?[\w.-]+\.(?:step|stp|stl|glb|py|gcode|urdf|srdf|sdf)[`'"]?(?:\s*,\s*[`'"]?[\w.-]+\.\w+[`'"]?)*/gim,
    'Design saved to workspace.',
  );
  out = out.replace(/`[\w.-]+\.(?:step|stp|stl|glb|py|gcode|urdf|srdf|sdf|implicit\.js)[`'"]?/gi, '');
  out = out.replace(/\b(?:models|parts|slices|assemblies)\/[\w.-]+\.\w+/gi, 'workspace');
  out = out.replace(/\b[\w.-]+\.(?:py|implicit\.js)\b/gi, '');
  out = out.replace(/\b[\w.-]+\.(?:step|stp|stl|glb|gcode|urdf|srdf|sdf)\b/gi, '');
  return out.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
}

/** True when assistant output is mostly generator code — hide from live chat stream. */
export function looksLikeGeneratorCode(text = '') {
  const t = String(text);
  if (/```/.test(t)) return true;
  if (/^\s*(import |from build123d|from cad|def gen_|class gen_)/im.test(t)) return true;
  if (/\bgen_step\s*\(|\bgen_urdf\s*\(|\bgen_srdf\s*\(|\bgen_sdf\s*\(/i.test(t)) return true;
  return false;
}

/** Strip fenced code and long script blocks from assistant text shown in chat UI. */
export function stripCodeFromReply(text = '') {
  let out = stripAgentMarkers(text);
  out = out.replace(/```[\s\S]*?```/g, '').trim();
  out = out.replace(/`[^`\n]+`/g, '').trim();
  out = out.replace(/^\s*import\s+[\w.]+.*$/gm, '').trim();
  out = out.replace(/^\s*from\s+[\w.]+\s+import\s+.*$/gm, '').trim();
  out = out.replace(/^\s*def\s+gen_\w+[\s\S]*?(?=^\S|\Z)/gm, '').trim();
  out = out.replace(/^\s*@[\w.]+\s*$/gm, '').trim();
  out = stripFileReferencesFromReply(out);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeAssistantReply(text = '') {
  const stripped = stripCodeFromReply(text);
  if (stripped) return stripped;
  if (looksLikeGeneratorCode(text)) {
    return 'Design prepared — check workspace for generated files.';
  }
  return stripAgentMarkers(text) || 'Done.';
}

function pushOutputFile(outputs, seen, file) {
  if (!file?.name || /\.py$/i.test(file.name)) return;
  const key = file.s3Key || file.name;
  if (seen.has(key)) return;
  seen.add(key);
  const folder = folderLabel(file.s3Key);
  outputs.push(`${fileKindLabel(file.name, file.kind)} — ${file.name} (${folder}/)`);
}

/** User-facing chat message after a successful (or failed) pipeline run. */
export function buildGenerationSummary(cadResult = null, { reply = '' } = {}) {
  const narrative = normalizeAssistantReply(reply);

  if (!cadResult) return narrative || 'Done.';

  if (!cadResult.ok) {
    const lead = narrative && !/^Design prepared/i.test(narrative) ? narrative : '';
    const tail = USER_ERRORS.cad;
    return lead ? `${lead}\n\n${tail}` : tail;
  }

  if (cadResult.deferred) return narrative || 'Reply in chat to continue the build.';

  const lines = [];
  if (narrative && !/^Design prepared/i.test(narrative)) {
    lines.push(narrative);
  } else {
    const skillLabel = SKILL_SUMMARY[cadResult.skill] || 'Design';
    lines.push(`${skillLabel} complete.`);
  }

  const outputs = [];
  const seen = new Set();
  pushOutputFile(outputs, seen, cadResult.file);
  pushOutputFile(outputs, seen, cadResult.stlFile);
  pushOutputFile(outputs, seen, cadResult.sliceFile);

  if (outputs.length) {
    if (lines.length) lines.push('');
    lines.push('What I built for you:');
    for (const row of outputs) lines.push(`• ${row}`);
    lines.push('');
    lines.push('Open the workspace panel or 3D viewer to inspect, measure, slice, or export.');
  } else if (!lines.length) {
    lines.push('Design saved to your workspace.');
  }

  return lines.join('\n').trim();
}
