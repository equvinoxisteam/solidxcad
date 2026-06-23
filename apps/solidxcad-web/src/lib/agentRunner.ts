import { streamChat, type CadResult, type StreamChatOptions } from '@/lib/api';
import { parseChatError, INSUFFICIENT_CREDITS_ERROR } from '@/lib/agentDisplay';
import { USER_ERRORS } from '@/lib/userFacingErrors';

const CHAT_MODEL = 'anthropic/claude-opus-4.7';

export type AgentPhase =
  | 'idle'
  | 'reading'
  | 'thinking'
  | 'planning'
  | 'exploring'
  | 'asking'
  | 'executing'
  | 'waiting'
  | 'searching';

export type AgentRunSnapshot = {
  projectId: string;
  streaming: boolean;
  pendingUser: string;
  workingStatus: string;
  liveReply: string;
  agentPhase: AgentPhase;
  streamError: string;
  followUpSuggestions: string[];
  creditsBlocked: boolean;
};

type AgentRunListener = (snapshot: AgentRunSnapshot | null) => void;
type AgentCompleteListener = (projectId: string, payload: DonePayload | null) => void;

type DonePayload = {
  cadResult?: CadResult;
  pipelineDeferred?: boolean;
  reply?: string;
  suggestions?: string[];
};

let activeRun: {
  snapshot: AgentRunSnapshot;
  promise: Promise<DonePayload | null>;
} | null = null;

const listeners = new Set<AgentRunListener>();
const completeListeners = new Set<AgentCompleteListener>();

function emptySnapshot(projectId: string): AgentRunSnapshot {
  return {
    projectId,
    streaming: false,
    pendingUser: '',
    workingStatus: '',
    liveReply: '',
    agentPhase: 'idle',
    streamError: '',
    followUpSuggestions: [],
    creditsBlocked: false,
  };
}

function notify() {
  const snap = activeRun?.snapshot ?? null;
  listeners.forEach((listener) => listener(snap));
}

function patchSnapshot(patch: Partial<AgentRunSnapshot>) {
  if (!activeRun) return;
  activeRun.snapshot = { ...activeRun.snapshot, ...patch };
  notify();
}

export function subscribeAgentRun(listener: AgentRunListener) {
  listeners.add(listener);
  listener(activeRun?.snapshot ?? null);
  return () => { listeners.delete(listener); };
}

export function subscribeAgentComplete(listener: AgentCompleteListener) {
  completeListeners.add(listener);
  return () => { completeListeners.delete(listener); };
}

function notifyComplete(projectId: string, payload: DonePayload | null) {
  completeListeners.forEach((listener) => listener(projectId, payload));
}

export function getAgentRunSnapshot(): AgentRunSnapshot | null {
  return activeRun?.snapshot ?? null;
}

export function isAgentRunning(projectId?: string) {
  if (!activeRun?.snapshot.streaming) return false;
  if (projectId) return activeRun.snapshot.projectId === projectId;
  return true;
}

export function formatWorkingStatus(message: string, status?: string): string | null {
  const msg = String(message || '').trim();
  if (!msg) return null;
  if (msg === 'Plan' || msg.startsWith('• ')) return 'Planning design…';
  if (/^Recovery:/i.test(msg)) return 'Refining design and retrying…';
  if (status === 'asking' || status === 'waiting') return 'Need your answer to continue…';
  if (status === 'error') return 'Adjusting approach…';
  if (/^Executing pipeline/i.test(msg)) return 'Running design pipeline…';
  if (/^Exploring workspace/i.test(msg)) return 'Reviewing project files…';
  if (/^Designing your solution/i.test(msg)) return 'Designing your solution…';
  if (/^Reading workspace/i.test(msg)) return 'Reading workspace…';
  const step = msg.replace(/^\[Step \d+\/\d+\]\s*/, '');
  if (step.length > 80) return `${step.slice(0, 77)}…`;
  return step;
}

export function startAgentRun(
  projectId: string,
  message: string,
  options: StreamChatOptions = {},
): Promise<DonePayload | null> {
  if (activeRun?.snapshot.streaming) {
    return activeRun.promise;
  }

  const snapshot = {
    ...emptySnapshot(projectId),
    streaming: true,
    pendingUser: message,
    workingStatus: 'Reading workspace…',
    agentPhase: 'reading' as AgentPhase,
  };

  const promise = new Promise<DonePayload | null>((resolve) => {
    streamChat(
      projectId,
      message,
      CHAT_MODEL,
      (delta) => {
        if (!activeRun) return;
        const phase = activeRun.snapshot.agentPhase;
        patchSnapshot({
          agentPhase: phase === 'searching' || phase === 'reading' ? 'thinking' : phase,
          liveReply: activeRun.snapshot.liveReply + delta,
        });
      },
      (payload) => {
        const projectIdDone = activeRun?.snapshot.projectId || projectId;
        patchSnapshot({
          streaming: false,
          pendingUser: '',
          workingStatus: '',
          liveReply: '',
          agentPhase: payload.pipelineDeferred ? 'waiting' : 'idle',
          followUpSuggestions: payload.suggestions?.length
            ? payload.suggestions
            : payload.pipelineDeferred
              ? ['Use standard engineering defaults and build it', 'Proceed — no more questions']
              : payload.cadResult && !payload.cadResult.ok
                ? ['Retry with simpler geometry', 'Use defaults and build again']
                : [],
        });
        activeRun = null;
        notify();
        notifyComplete(projectIdDone, payload);
        resolve(payload);
      },
      (err) => {
        const projectIdDone = activeRun?.snapshot.projectId || projectId;
        const parsed = parseChatError(err);
        if (parsed.code === INSUFFICIENT_CREDITS_ERROR) {
          patchSnapshot({
            streaming: false,
            pendingUser: '',
            workingStatus: '',
            liveReply: '',
            agentPhase: 'idle',
            creditsBlocked: true,
            streamError: parsed.message,
          });
        } else {
          patchSnapshot({
            streaming: false,
            pendingUser: '',
            workingStatus: '',
            liveReply: '',
            agentPhase: 'idle',
            streamError: parsed.message || USER_ERRORS.chat,
            followUpSuggestions: ['Try again', 'Use standard defaults and build it', 'Simplify the design'],
          });
        }
        activeRun = null;
        notify();
        notifyComplete(projectIdDone, null);
        resolve(null);
      },
      (msg, _skill, status) => {
        if (status === 'planning') patchSnapshot({ agentPhase: 'planning' });
        else if (status === 'exploring') patchSnapshot({ agentPhase: 'exploring' });
        else if (status === 'asking') patchSnapshot({ agentPhase: 'asking' });
        else if (status === 'running' || status === 'done') patchSnapshot({ agentPhase: 'executing' });
        const label = formatWorkingStatus(msg, status);
        if (label) patchSnapshot({ workingStatus: label });
      },
      (phase, msg) => {
        patchSnapshot({ agentPhase: phase as AgentPhase });
        const label = formatWorkingStatus(msg, phase);
        if (label) patchSnapshot({ workingStatus: label });
      },
      options,
    ).catch(() => {
      activeRun = null;
      notify();
      resolve(null);
    });
  });

  activeRun = { snapshot, promise };
  notify();
  return promise;
}
