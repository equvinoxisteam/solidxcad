import { config } from '../config.js';
import { CHAT_MODELS, ALLOWED_CHAT_MODEL_IDS } from './chatModels.js';
import { pickChatModel } from './modelPicker.js';

export { CHAT_MODELS };

export function getChatModels() {
  const defaultId = config.openrouter.modelCad;
  return {
    models: CHAT_MODELS,
    defaultModel: ALLOWED_CHAT_MODEL_IDS.has(defaultId) ? defaultId : CHAT_MODELS[0].id,
  };
}

export function resolveChatModel(requested, pickerContext = {}) {
  if (requested === 'auto') {
    return pickChatModel(pickerContext.message || '', pickerContext);
  }
  if (requested && ALLOWED_CHAT_MODEL_IDS.has(requested)) return requested;
  const { defaultModel } = getChatModels();
  return defaultModel;
}
