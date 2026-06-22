import { DEFAULT_CHAT_MODEL } from './chatModels.js';

/** SolidX CAD uses Claude Opus 4.7 for all agent turns. */
export function pickChatModel() {
  return DEFAULT_CHAT_MODEL;
}

export function modelLabel(modelId) {
  if (modelId === DEFAULT_CHAT_MODEL) return 'Claude Opus 4.7';
  return modelId;
}
