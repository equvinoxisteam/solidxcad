import { stripAgentMarkers } from './agentBehavior.js';

/** Strip fenced code and long script blocks from assistant text shown in chat UI. */
export function stripCodeFromReply(text = '') {
  let out = stripAgentMarkers(text);
  out = out.replace(/```[\s\S]*?```/g, '').trim();
  out = out.replace(/^\s*import\s+[\w.]+.*$/gm, '').trim();
  out = out.replace(/^\s*def\s+gen_\w+.*$/gm, '').trim();
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeAssistantReply(text = '') {
  const stripped = stripCodeFromReply(text);
  if (stripped) return stripped;
  if (/```/.test(text) || /def gen_/i.test(text)) {
    return 'Design prepared — check workspace for generated files.';
  }
  return stripAgentMarkers(text) || 'Done.';
}
