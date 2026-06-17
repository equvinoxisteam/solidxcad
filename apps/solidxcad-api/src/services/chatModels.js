export const CHAT_MODELS = [
  {
    id: 'anthropic/claude-3.5-haiku',
    label: 'Claude 3.5 Haiku',
    tier: 'fast',
    description: 'Fast & low cost — best for testing',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    label: 'Gemini 2.0 Flash',
    tier: 'fast',
    description: 'Very cheap, good for simple parts',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    tier: 'fast',
    description: 'Balanced speed and quality',
  },
  {
    id: 'anthropic/claude-opus-4.7',
    label: 'Claude Opus 4.7',
    tier: 'quality',
    description: 'Highest quality — best for complex CAD',
  },
  {
    id: 'anthropic/claude-sonnet-4',
    label: 'Claude Sonnet 4',
    tier: 'quality',
    description: 'Strong CAD code quality',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    tier: 'quality',
    description: 'Strong reasoning for complex geometry',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    tier: 'budget',
    description: 'Open model, lowest cost',
  },
];

export const ALLOWED_CHAT_MODEL_IDS = new Set(CHAT_MODELS.map((m) => m.id));
