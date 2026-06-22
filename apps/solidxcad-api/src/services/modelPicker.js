import { DEFAULT_CHAT_MODEL } from './chatModels.js';

/** SolidX CAD uses Claude Opus 4.7 for all agent turns. */
export function pickChatModel() {
  return DEFAULT_CHAT_MODEL;
}

export function modelLabel(modelId) {
  if (modelId === DEFAULT_CHAT_MODEL) return 'Claude Opus 4.7';
  return modelId;
}

/** Agent auto-enables OpenRouter web grounding when factual reference data helps. */
export function inferWebSearchNeeded(message = '', { hasImage = false, skill = 'cad' } = {}) {
  const msg = String(message).trim();
  if (!msg && !hasImage) return false;

  if (hasImage) return true;

  return /\b(iso|din|ansi|astm|standard|specification|bearing|fastener|m[2-8]|socket.?head|cap screw|nema|datasheet|catalog|step\.parts|lookup|search|product dimensions?|real.?world|off.?the.?shelf|commercial|rocket|engine|nozzle|turbopump|combustion|sand\s*print|binder\s*jet|urdf|moveit|joint\s*limit|inertia|dh\s*param|robot\s*arm|manipulator|workspace|thrust|aerospace|propellant)\b/i.test(msg)
    || ['urdf', 'srdf', 'sdf', 'step-parts'].includes(skill)
    || /\b(build from scratch|from scratch|complete|fully|end to end)\b/i.test(msg);
}
