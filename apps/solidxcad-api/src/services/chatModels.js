export const DEFAULT_CHAT_MODEL = 'anthropic/claude-opus-4.7';

export const CHAT_MODELS = [
  {
    id: DEFAULT_CHAT_MODEL,
    label: 'Claude Opus 4.7',
    tier: 'quality',
    description: 'Highest quality — used for all agent chat',
  },
];

export const ALLOWED_CHAT_MODEL_IDS = new Set(CHAT_MODELS.map((m) => m.id));
