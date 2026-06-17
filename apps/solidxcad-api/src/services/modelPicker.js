import { config } from '../config.js';
import { CHAT_MODELS, ALLOWED_CHAT_MODEL_IDS } from './chatModels.js';

const VISION_MODEL = 'openai/gpt-4o';
const FAST_MODEL = 'anthropic/claude-3.5-haiku';
const WEB_MODEL = 'google/gemini-2.0-flash-001';
const QUALITY_MODEL = 'anthropic/claude-sonnet-4';

function defaultCadModel() {
  const id = config.openrouter?.modelCad;
  return ALLOWED_CHAT_MODEL_IDS.has(id) ? id : QUALITY_MODEL;
}

/**
 * Pick a chat model from the user message and turn context when modelMode is auto.
 */
export function pickChatModel(message = '', {
  webSearch = false,
  hasImage = false,
  contextFiles = [],
  skill = 'cad',
} = {}) {
  const msg = String(message).trim();
  const lower = msg.toLowerCase();

  if (hasImage) return VISION_MODEL;
  if (webSearch) return WEB_MODEL;

  const robotic = /\b(urdf|srdf|sdf|robot|robotic|manipulator|gripper|linkage)\b/i.test(msg)
    || ['urdf', 'srdf', 'sdf'].includes(skill);
  const complexCad = /\b(assembly|assemble|implicit|fractal|hilbert|lattice|gyroid|voronoi|compound|sand\s*print|binder\s*jet|inkjet|ink\s*jet|powder\s*bed|recoater|corexy|gantry|machine\s*frame|printer\s*frame|from scratch)\b/i.test(msg);
  const hasCadContext = contextFiles.some((f) =>
    /\.(step|stp|stl|glb|urdf|srdf|sdf)$/i.test(f.name || ''),
  );

  if (robotic || complexCad || hasCadContext) return defaultCadModel();

  const simplePart = /\b\d+(\.\d+)?\s*(mm|cm|m)\b/i.test(msg)
    && msg.length < 160
    && !/\b(assembly|urdf|srdf|sdf)\b/i.test(lower);

  if (simplePart) return FAST_MODEL;

  return defaultCadModel();
}

export function modelLabel(modelId) {
  return CHAT_MODELS.find((m) => m.id === modelId)?.label || modelId;
}

/** Detect when factual web grounding helps (auto mode enables search without user toggle). */
export function inferWebSearchNeeded(message = '') {
  const msg = String(message).trim();
  if (!msg) return false;
  return /\b(iso|din|ansi|astm|standard|specification|bearing|fastener|m[2-8]|socket.?head|cap screw|nema|arduino|raspberry|datasheet|catalog|step\.parts|lookup|search (the )?web|current (model|version|spec)|product dimensions?|real.?world|off.?the.?shelf|commercial|sand\s*print|binder\s*jet|inkjet|ink\s*jet|powder\s*bed|recoater|corexy|gantry|linear\s*rail|2020\s*extrusion|aluminum\s*extrusion)\b/i.test(msg);
}
