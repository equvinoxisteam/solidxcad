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

export function sanitizeAssistantForDisplay(text: string) {
  const stripped = stripCodeFromDisplay(text);
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
  return true;
}

export type MentionFile = { _id: string; name: string; kind?: string };

/** Parse @filename tokens from user input and resolve to file ids. */
export function resolveMentionedFileIds(text: string, files: MentionFile[]) {
  const ids: string[] = [];
  for (const file of files) {
    const token = `@${file.name}`;
    if (text.includes(token)) ids.push(file._id);
  }
  return ids;
}
