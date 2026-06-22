import { sanitizeUserError } from '@/lib/userFacingErrors';

export function stripAgentMarkers(text: string) {
  return text
    .replace(/\[AGENT_PHASE:\s*(clarify|execute|plan)\]\s*/gi, '')
    .replace(/\[AGENT_PLAN\][\s\S]*?\[\/AGENT_PLAN\]/gi, '')
    .trim();
}

export function looksLikeGeneratorCode(text: string) {
  const t = String(text);
  if (/```/.test(t)) return true;
  if (/^\s*(import |from build123d|from cad|def gen_|class gen_)/im.test(t)) return true;
  if (/\bgen_step\s*\(|\bgen_urdf\s*\(|\bgen_srdf\s*\(|\bgen_sdf\s*\(/i.test(t)) return true;
  return false;
}

export function stripCodeFromDisplay(text: string) {
  let out = stripAgentMarkers(text);
  out = out.replace(/```[\s\S]*?```/g, '').trim();
  out = out.replace(/`[^`\n]+`/g, '').trim();
  out = out.replace(/^\s*import\s+[\w.]+.*$/gm, '').trim();
  out = out.replace(/^\s*from\s+[\w.]+\s+import\s+.*$/gm, '').trim();
  out = out.replace(/^\s*def\s+gen_\w+.*$/gm, '').trim();
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

/** Remove CAD artifact paths and filenames from user-visible chat text. */
export function stripFileReferencesFromDisplay(text: string) {
  let out = text;
  out = out.replace(
    /^Files?:\s*[`'"]?[\w.-]+\.(?:step|stp|stl|glb|py|gcode|urdf|srdf|sdf)[`'"]?(?:\s*,\s*[`'"]?[\w.-]+\.\w+[`'"]?)*/gim,
    'Design saved to workspace.',
  );
  out = out.replace(/`[\w.-]+\.(?:step|stp|stl|glb|py|gcode|urdf|srdf|sdf|implicit\.js)[`'"]?/gi, '');
  out = out.replace(/\b(?:models|parts|slices|assemblies)\/[\w.-]+\.\w+/gi, 'workspace');
  out = out.replace(/\b[\w.-]+\.(?:py|implicit\.js)\b/gi, '');
  out = out.replace(/\b[\w.-]+\.(?:step|stp|stl|glb|gcode|urdf|srdf|sdf)\b/gi, '');
  out = out.replace(/,\s*,/g, ',').replace(/:\s*,/g, ':').replace(/\s{2,}/g, ' ').trim();
  return out;
}

export function sanitizeAssistantForDisplay(text: string) {
  const stripped = stripCodeFromDisplay(text);
  if (stripped) return stripped;
  if (looksLikeGeneratorCode(text)) {
    return 'Design prepared — see workspace for generated files.';
  }
  return stripAgentMarkers(text) || 'Done.';
}

export function isUserVisibleFile(name: string, kind?: string) {
  if (/\.py$/i.test(name)) return false;
  const k = (kind || '').toLowerCase();
  if (k === 'python' || k === 'script' || k === 'py') return false;
  if (/\.implicit\.js$/i.test(name)) return true;
  return true;
}

export type MentionFile = { _id: string; name: string; kind?: string };

export type CadResultLike = {
  ok?: boolean;
  skill?: string;
  deferred?: boolean;
  file?: { name?: string; kind?: string; s3Key?: string };
  stlFile?: { name?: string; kind?: string; s3Key?: string };
  sliceFile?: { name?: string; kind?: string; s3Key?: string };
};

const FILE_KIND_LABELS: Record<string, string> = {
  step: 'STEP geometry',
  stp: 'STEP geometry',
  stl: 'STL mesh',
  glb: 'GLB preview',
  '3mf': '3MF print package',
  dxf: 'DXF drawing',
  gcode: 'G-code toolpath',
  urdf: 'URDF robot',
  srdf: 'SRDF config',
  sdf: 'SDF simulation',
};

function fileKindLabel(name: string, kind?: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (/implicit\.js$/i.test(name)) return 'Implicit CAD';
  return FILE_KIND_LABELS[ext] || kind || 'Design file';
}

function folderLabel(s3Key?: string) {
  if (s3Key?.includes('/assemblies/')) return 'assemblies';
  if (s3Key?.includes('/parts/')) return 'parts';
  if (s3Key?.includes('/slices/')) return 'slices';
  return 'models';
}

/** Build result cards shown after a successful generation. */
export function buildGeneratedItemLabels(cadResult: CadResultLike) {
  const items: { skill: string; label: string }[] = [];
  const skill = cadResult.skill || 'cad';
  const push = (file: { name?: string; kind?: string; s3Key?: string } | undefined, itemSkill: string) => {
    if (!file?.name || /\.py$/i.test(file.name)) return;
    const folder = folderLabel(file.s3Key);
    items.push({
      skill: itemSkill,
      label: `${fileKindLabel(file.name, file.kind)} — ${file.name} (${folder}/)`,
    });
  };
  push(cadResult.file, skill);
  push(cadResult.stlFile, 'cad');
  push(cadResult.sliceFile, 'gcode');
  return items;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

/** Parse @filename tokens from user input and resolve to file ids. */
export function resolveMentionedFileIds(text: string, files: MentionFile[]) {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const full = `@${file.name}`;
    const short = `@${baseName(file.name)}`;
    if (text.includes(full) || text.includes(short)) {
      if (!seen.has(file._id)) {
        seen.add(file._id);
        ids.push(file._id);
      }
    }
  }
  return ids;
}

export const INSUFFICIENT_CREDITS_ERROR = 'INSUFFICIENT_CREDITS';

export function parseChatError(err: string): { code: string; message: string } {
  try {
    const parsed = JSON.parse(err) as { code?: string; message?: string };
    if (parsed?.code === INSUFFICIENT_CREDITS_ERROR) {
      return {
        code: INSUFFICIENT_CREDITS_ERROR,
        message: parsed.message || 'You are out of design credits. Add credits to continue.',
      };
    }
  } catch {
    // plain string
  }
  if (/insufficient credits/i.test(err)) {
    return { code: INSUFFICIENT_CREDITS_ERROR, message: 'You are out of design credits. Add credits to continue.' };
  }
  return { code: 'error', message: sanitizeUserError(err, 'chat') };
}
