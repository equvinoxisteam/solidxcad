// Browser: same-origin /api via Next rewrite. Long jobs (slice) can bypass proxy.
import type { SliceSettings } from '@/lib/sliceSettings';
import { sanitizeUserError } from '@/lib/userFacingErrors';

const DIRECT_API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

const API_URL = typeof window !== 'undefined' ? '' : DIRECT_API_URL;

export class ApiError extends Error {
  googleRequired?: boolean;

  constructor(message: string, extras?: { googleRequired?: boolean }) {
    super(message);
    this.name = 'ApiError';
    this.googleRequired = extras?.googleRequired;
  }
}

export function projectId(project: { _id?: string; id?: string }) {
  return project._id || project.id || '';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('solidxcad_token');
}

export function setToken(token: string) {
  localStorage.setItem('solidxcad_token', token);
}

export function clearToken() {
  localStorage.removeItem('solidxcad_token');
  localStorage.removeItem('solidxcad_user');
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('solidxcad_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: unknown) {
  localStorage.setItem('solidxcad_user', JSON.stringify(user));
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  directApi = false,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const base = directApi && typeof window !== 'undefined' ? DIRECT_API_URL : API_URL;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...options, headers });
  } catch {
    throw new Error(sanitizeUserError('', 'network'));
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new ApiError('Please log in again');
    if (res.status === 402 && (data as { code?: string }).code === 'INSUFFICIENT_CREDITS') {
      throw new ApiError((data as { message?: string }).message || 'You are out of design credits. Add credits to continue.');
    }
    throw new ApiError(sanitizeUserError((data as { error?: string }).error || (data as { message?: string }).message), {
      googleRequired: Boolean((data as { googleRequired?: boolean }).googleRequired),
    });
  }
  return data as T;
}

export const api = {
  sendOtp: (body: { email: string; purpose: 'signup' | 'reset' }) =>
    request<{ ok: boolean; message: string; devOtp?: string }>('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyOtp: (body: { email: string; purpose: 'signup' | 'reset'; code: string }) =>
    request<{ ok: boolean; verified: boolean }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: { name?: string; email: string; password: string; otp: string }) =>
    request<{ token: string; user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  resetPassword: (body: { email: string; otp: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  googleVerify: (credential: string) =>
    request<{ token: string; user: User }>('/api/auth/google/verify', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),

  completeOnboarding: (body: {
    name?: string;
    useCase?: string;
    experience?: string;
    goal?: string;
    complete?: boolean;
  }) =>
    request<{ user: User }>('/api/auth/onboarding', { method: 'PATCH', body: JSON.stringify(body) }),

  updateProfile: (body: { name?: string; phone?: string; avatarDataUrl?: string }) =>
    request<{ user: User }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  me: () => request<{ user: User }>('/api/auth/me'),

  getProjects: () => request<{ projects: Project[] }>('/api/projects'),

  createProject: (body: { name: string; description?: string }) =>
    request<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),

  getProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),

  updateProject: (id: string, body: { name?: string; description?: string }) =>
    request<{ project: Project }>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteProject: (id: string) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  getFiles: (projectId: string) => request<{ files: ProjectFile[] }>(`/api/projects/${projectId}/files`),

  getMessages: (projectId: string) => request<{ messages: ChatMessage[] }>(`/api/projects/${projectId}/messages`),

  chat: (body: { projectId: string; message: string; stream?: boolean }) =>
    request<{ reply: string; cadResult?: CadResult }>('/api/agent/chat', { method: 'POST', body: JSON.stringify(body) }),

  billingConfig: () => request<BillingConfig>('/api/billing/config'),

  createOrder: () => request<{ orderId: string; amount: number; currency: string; keyId: string }>('/api/billing/create-order', { method: 'POST', body: '{}' }),

  verifyPayment: (body: Record<string, string>) =>
    request<{ ok: boolean; plan: string; credits: number }>('/api/billing/verify', { method: 'POST', body: JSON.stringify(body) }),

  searchParts: (query: string) =>
    request<unknown>('/api/manufacturing/parts/search', { method: 'POST', body: JSON.stringify({ query }) }),

  browseParts: () =>
    request<{ parts: unknown[] }>('/api/manufacturing/parts/browse'),

  importPart: (body: { projectId: string; partId?: string; partUrl?: string; name?: string }) =>
    request<{ file: ProjectFile }>('/api/manufacturing/parts/import', { method: 'POST', body: JSON.stringify(body) }),

  sliceModel: (body: { projectId: string; fileId: string; profilePath?: string; settings?: SliceSettings }) =>
    request<{ ok: boolean; file?: ProjectFile; error?: string }>(
      '/api/manufacturing/slice',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),

  syncViewerWorkspace: (projectId: string) =>
    request<ViewerSyncResult>(`/api/viewer/projects/${projectId}/sync`, { method: 'POST', body: '{}' }),

  getViewerSession: (projectId: string, fileRef?: string) => {
    const q = fileRef ? `?file=${encodeURIComponent(fileRef)}` : '';
    return request<ViewerSession>(`/api/viewer/projects/${projectId}/session${q}`);
  },

  getViewerCatalog: (projectId: string) =>
    request<{ schemaVersion: number; entries: unknown[] }>(`/api/viewer/projects/${projectId}/catalog`),

  regenerateStepParameters: (
    projectId: string,
    body: { step: string; parameters: Record<string, number | boolean | string> },
  ) =>
    request<{ ok: boolean; file?: ProjectFile; partName?: string; error?: string }>(
      `/api/viewer/projects/${projectId}/regenerate-step`,
      { method: 'POST', body: JSON.stringify(body) },
      true,
    ),

  getChatModels: () => request<ChatModelsResponse>('/api/agent/models'),
};

export type ChatModel = {
  id: string;
  label: string;
  tier: 'fast' | 'quality' | 'budget';
  description: string;
};

export type ChatModelsResponse = {
  models: ChatModel[];
  defaultModel: string;
};

const MODEL_STORAGE_KEY = 'solidxcad_chat_model';
const MODEL_AUTO_STORAGE_KEY = 'solidxcad_model_auto';

export function getStoredModelAuto(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(MODEL_AUTO_STORAGE_KEY);
  if (v === '0') return false;
  return true;
}

export function setStoredModelAuto(auto: boolean) {
  localStorage.setItem(MODEL_AUTO_STORAGE_KEY, auto ? '1' : '0');
}

export function getStoredChatModel(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(MODEL_STORAGE_KEY);
}

export function setStoredChatModel(modelId: string) {
  localStorage.setItem(MODEL_STORAGE_KEY, modelId);
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  credits: number;
  unlimitedCredits?: boolean;
  onboardingCompleted?: boolean;
  isVerified?: boolean;
  authProvider?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  onboarding?: { useCase?: string; experience?: string; goal?: string };
};

export type BillingConfig = {
  keyId: string;
  unlimitedCredits?: boolean;
  plan: { name: string; amountUsd: number; credits: number | string };
  freeCredits: number | string;
};

export function isUnlimitedUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.unlimitedCredits || user.credits >= 999_999);
}

export function formatCreditCount(value: number): string {
  return Number(value || 0).toLocaleString();
}

export function formatCredits(user: User | null | undefined): string {
  if (!user) return '0';
  if (isUnlimitedUser(user)) return 'Unlimited';
  return formatCreditCount(user.credits);
}

export function creditPlanLimit(
  user: User | null | undefined,
  billing: BillingConfig | null | undefined,
): number | null {
  if (!user || isUnlimitedUser(user)) return null;
  if (user.plan === 'pro') {
    const pro = billing?.plan?.credits;
    return typeof pro === 'number' ? pro : 500;
  }
  const free = billing?.freeCredits;
  return typeof free === 'number' ? free : 100;
}

export function creditUsageSummary(
  user: User | null | undefined,
  billing: BillingConfig | null | undefined,
) {
  const remaining = user?.credits ?? 0;
  const unlimited = isUnlimitedUser(user);
  const limit = creditPlanLimit(user, billing);
  const used = limit != null ? Math.max(0, limit - remaining) : 0;
  const percentRemaining = unlimited || limit == null
    ? 100
    : Math.min(100, Math.max(0, (remaining / limit) * 100));
  return { remaining, unlimited, limit, used, percentRemaining };
}

export type Project = {
  _id: string;
  name: string;
  description?: string;
  updatedAt: string;
  createdAt: string;
};

export type ProjectFile = {
  _id: string;
  name: string;
  kind: string;
  downloadUrl: string;
  s3Key: string;
  createdAt?: string;
};

export type ChatMessage = {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

export type CadResult = {
  ok: boolean;
  skill?: string;
  url?: string;
  error?: string;
  repaired?: boolean;
  deferred?: boolean;
  hint?: string;
  hintMessage?: string;
  file?: { _id?: string; name: string; kind: string; s3Key?: string };
  sliceFile?: { _id?: string; name: string; kind: string; s3Key?: string };
};

export type ViewerSession = {
  viewerUrl: string;
  workspaceDir: string;
  file: string;
  catalogUrl: string;
  viewerLink: string;
};

export type ViewerSyncResult = {
  workspaceDir: string;
  files: { id: string; file: string; name: string; kind: string }[];
  viewerUrl: string;
};

export type StreamChatOptions = {
  contextFileIds?: string[];
  imageDataUrl?: string;
  modelMode?: 'auto' | 'manual';
  selectionContext?: string;
  viewerFileId?: string;
};

export async function streamChat(
  projectId: string,
  message: string,
  model: string,
  onDelta: (text: string) => void,
  onDone: (payload: {
    cadResult?: CadResult;
    pipelineDeferred?: boolean;
    reply?: string;
    modelUsed?: string;
    webSearchUsed?: boolean;
  }) => void,
  onError: (err: string) => void,
  onCadStatus?: (message: string, skill?: string, status?: string) => void,
  onAgentPhase?: (phase: string, message: string) => void,
  options: StreamChatOptions = {},
) {
  const token = getToken();
  const modelMode = options.modelMode || (model === 'auto' ? 'auto' : 'manual');
  const res = await fetch(`/api/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      projectId,
      message,
      model: modelMode === 'auto' ? 'auto' : model,
      modelMode,
      stream: true,
      generateCad: true,
      contextFileIds: options.contextFileIds || [],
      imageDataUrl: options.imageDataUrl || '',
      selectionContext: options.selectionContext || '',
      viewerFileId: options.viewerFileId || '',
    }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({})) as { error?: string; code?: string; message?: string; balance?: number };
    if (res.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
      onError(JSON.stringify({
        code: 'INSUFFICIENT_CREDITS',
        message: data.message || 'You are out of design credits. Add credits in Settings or upgrade to Pro to continue.',
        balance: data.balance,
      }));
      return;
    }
    onError(data.message || sanitizeUserError(data.error, 'chat'));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      try {
        const json = JSON.parse(line.slice(5));
        if (json.type === 'delta') onDelta(json.content);
        if (json.type === 'agent_phase' && json.phase) {
          onAgentPhase?.(json.phase, json.message || json.phase);
        }
        if (json.type === 'cad_status' && json.message) {
          onCadStatus?.(json.message, json.skill, json.status);
        }
        if (json.type === 'done') {
          onDone({
            cadResult: json.cadResult,
            pipelineDeferred: json.pipelineDeferred,
            reply: json.reply,
            modelUsed: json.modelUsed,
            webSearchUsed: json.webSearchUsed,
          });
        }
        if (json.type === 'error') onError(sanitizeUserError(json.error, 'chat'));
      } catch {
        // ignore
      }
    }
  }
}
