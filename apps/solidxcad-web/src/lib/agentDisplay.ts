/** Display helpers for agent chat — never show raw code blocks to users. */

export function stripAgentMarkers(text: string) {
  return text
    .replace(/\[AGENT_PHASE:\s*(clarify|execute|plan)\]\s*/gi, '')
    .replace(/\[AGENT_PLAN\][\s\S]*?\[\/AGENT_PLAN\]/gi, '')
    .trim();
}

export function stripCodeFromDisplay(text: string) {
  let out = stripAgentMarkers(text);
  out = out.replace(/```[\s\S]*?```/g, '').trim();
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
  out = out.replace(/`[\w.-]+\.(?:step|stp|stl|glb|py|gcode|urdf|srdf|sdf)`/gi, '');
  out = out.replace(/\b(?:models|parts|slices)\/[\w.-]+\.\w+/gi, 'workspace');
  out = out.replace(
    /\b[\w.-]+\.(?:step|stp|stl|glb|py|gcode|urdf|srdf|sdf)\b/gi,
    '',
  );
  out = out.replace(/,\s*,/g, ',').replace(/:\s*,/g, ':').replace(/\s{2,}/g, ' ').trim();
  return out;
}

export function sanitizeAssistantForDisplay(text: string) {
  const stripped = stripFileReferencesFromDisplay(stripCodeFromDisplay(text));
  if (stripped) return stripped;
  if (/```/.test(text) || /def gen_/i.test(text)) {
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
