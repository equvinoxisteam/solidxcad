import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from './chatModels.js';

export { CHAT_MODELS };

export function getChatModels() {
  return {
    models: CHAT_MODELS,
    defaultModel: DEFAULT_CHAT_MODEL,
  };
}

export function resolveChatModel() {
  return DEFAULT_CHAT_MODEL;
}
