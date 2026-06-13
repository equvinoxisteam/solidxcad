'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Box,
  ChevronDown,
  Globe,
  Loader2,
  Paperclip,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import {
  api,
  getStoredChatModel,
  getStoredWebSearch,
  setStoredChatModel,
  setStoredWebSearch,
  streamChat,
} from '@/lib/api';
import type { CadResult, ChatMessage, ChatModel } from '@/lib/api';
import { BrandLogo } from '@/components/BrandLogo';

type AgentStep = { message: string; skill?: string; status?: string };
type AgentPhase = 'idle' | 'reading' | 'thinking' | 'planning' | 'exploring' | 'asking' | 'executing' | 'waiting' | 'searching';

const ASSEMBLY_STEP1 = 'Import M3 socket head cap screw from step.parts';
const ASSEMBLY_STEP2 =
  'Assembly: 50×30×5 mm mount plate with 4 corner holes and the imported screws at each hole.';

const PROMPTS = [
  '30mm cube with 4× M3 holes',
  ASSEMBLY_STEP1,
  ASSEMBLY_STEP2,
  'Make a 20mm cube with 2mm fillets on all edges',
];

const PHASE_LABELS: Record<string, string> = {
  reading: 'Reading workspace',
  thinking: 'Designing',
  planning: 'Planning',
  exploring: 'Exploring',
  asking: 'Clarifying',
  waiting: 'Waiting for you',
  executing: 'Building',
  running: 'Building',
  searching: 'Web search',
};

const SKILL_LABELS: Record<string, string> = {
  cad: 'Solid modeling',
  urdf: 'URDF',
  srdf: 'SRDF',
  sdf: 'SDF',
  'implicit-cad': 'Implicit CAD',
  'step-parts': 'Parts catalog',
  sendcutsend: 'SendCutSend',
  agent: 'Assistant',
};

const FALLBACK_MODELS: ChatModel[] = [
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', tier: 'fast', description: 'Fast' },
  { id: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7', tier: 'quality', description: 'Highest quality' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', tier: 'quality', description: 'Strong quality' },
];

function stripAgentMarkers(text: string) {
  return text
    .replace(/\[AGENT_PHASE:\s*(clarify|execute|plan)\]\s*/gi, '')
    .replace(/\[AGENT_PLAN\][\s\S]*?\[\/AGENT_PLAN\]/gi, '')
    .trim();
}

function friendlyError(_msg: string) {
  return 'Adjusting approach — resend your message or try a simpler prompt.';
}

export function ChatPanel({
  projectId,
  messages,
  onMessagesChange,
  onCadGenerated,
}: {
  projectId: string;
  messages: ChatMessage[];
  onMessagesChange: () => void;
  onCadGenerated: (result: CadResult) => void;
}) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [lastDesign, setLastDesign] = useState<{ name: string; skill?: string } | null>(null);
  const [assemblyHint, setAssemblyHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWebSearch(getStoredWebSearch());
    api.getChatModels()
      .then(({ models: list, defaultModel }) => {
        setModels(list);
        const stored = getStoredChatModel();
        const valid = list.some((m) => m.id === stored);
        setSelectedModel(valid && stored ? stored : defaultModel);
      })
      .catch(() => {
        setModels(FALLBACK_MODELS);
        const stored = getStoredChatModel();
        setSelectedModel(stored && FALLBACK_MODELS.some((m) => m.id === stored)
          ? stored
          : FALLBACK_MODELS[0].id);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText, agentSteps, agentPhase]);

  const activeModel = models.find((m) => m.id === selectedModel);

  function onModelChange(modelId: string) {
    setSelectedModel(modelId);
    setStoredChatModel(modelId);
  }

  function toggleWebSearch() {
    setWebSearch((v) => {
      const next = !v;
      setStoredWebSearch(next);
      return next;
    });
  }

  async function send(message?: string) {
    const text = (message || input).trim();
    if (!text || streaming || !selectedModel) return;
    setInput('');
    setStreaming(true);
    setStreamText('');
    setAgentSteps([]);
    setAgentPhase(webSearch ? 'searching' : 'reading');
    setAssemblyHint(null);

    await streamChat(
      projectId,
      text,
      selectedModel,
      webSearch,
      (delta) => {
        setAgentPhase((p) => (p === 'searching' || p === 'reading' ? 'thinking' : p));
        setStreamText((s) => s + delta);
      },
      ({ cadResult, pipelineDeferred }) => {
        setStreaming(false);
        setStreamText('');
        setAgentPhase(pipelineDeferred ? 'waiting' : 'idle');
        onMessagesChange();
        if (cadResult?.hint === 'assembly_needs_parts') {
          setAssemblyHint(cadResult.hintMessage || null);
          setAgentSteps((steps) => [
            ...steps,
            { message: 'Import a catalog part first — see steps below', skill: 'agent', status: 'asking' },
          ]);
        } else if (pipelineDeferred) {
          setAgentSteps((steps) => [
            ...steps,
            { message: 'Reply in chat to continue the build', skill: 'agent', status: 'asking' },
          ]);
        } else if (cadResult && !cadResult.deferred && cadResult.ok) {
          const name = cadResult.file?.name;
          if (name) setLastDesign({ name, skill: cadResult.skill });
          onCadGenerated(cadResult);
        }
      },
      () => {
        setStreaming(false);
        setStreamText('');
        setAgentPhase('idle');
        setAgentSteps((steps) => [
          ...steps,
          { message: friendlyError(''), skill: 'agent', status: 'running' },
        ]);
        onMessagesChange();
      },
      (msg, skill, status) => {
        if (status === 'planning') setAgentPhase('planning');
        else if (status === 'exploring') setAgentPhase('exploring');
        else if (status === 'asking') setAgentPhase('asking');
        else if (status === 'running' || status === 'done') setAgentPhase('executing');
        setAgentSteps((steps) => [...steps, { message: msg, skill, status }]);
      },
      (phase, msg) => {
        setAgentPhase(phase as AgentPhase);
        setAgentSteps((steps) => [...steps, { message: msg, skill: 'agent', status: phase }]);
      },
    );
  }

  const phaseLabel = PHASE_LABELS[agentPhase] || '';

  return (
    <aside className="w-full lg:w-[380px] border-l border-border bg-[#0d1a30] flex flex-col shrink-0">
      <div className="bg-gradient-to-r from-brand to-brand-light text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <BrandLogo size={22} showName={false} href={undefined} className="pointer-events-none" />
          Agent Window
        </div>
        <span className="text-[10px] font-medium bg-white/15 px-2 py-0.5 rounded-full flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${streaming ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'}`} />
          {streaming ? phaseLabel || 'Working' : 'Ready'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {!messages.length && !streamText && (
          <div className="space-y-2">
            <p className="text-xs text-muted">SolidX CAD can model parts, assemblies, robots, and more. Try:</p>
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="block w-full text-left text-xs bg-panel/60 border border-border rounded-lg p-2.5 hover:border-brand/50 hover:bg-brand/10 text-white/90 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m._id}
            className={`text-sm rounded-xl p-3 border ${
              m.role === 'user'
                ? 'bg-brand/15 border-brand/30 ml-4'
                : 'bg-panel/50 border-border mr-1'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="text-[10px] uppercase text-brand-muted font-semibold mb-1.5 tracking-wide">
                SolidX Assistant
              </div>
            )}
            <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90 max-h-56 overflow-y-auto">
              {m.role === 'assistant' ? stripAgentMarkers(m.content) : m.content}
            </div>
          </div>
        ))}

        {streamText && (
          <div className="text-sm rounded-xl p-3 bg-panel/50 border border-border mr-1">
            <div className="text-[10px] uppercase text-brand-muted font-semibold mb-1.5">SolidX Assistant</div>
            <div className="whitespace-pre-wrap break-words text-[13px] text-white/90 max-h-56 overflow-y-auto">
              {stripAgentMarkers(streamText)}
            </div>
          </div>
        )}

        {assemblyHint && !streaming && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mr-1 space-y-2">
            <div className="text-[10px] uppercase text-amber-200 font-semibold">Assembly workflow</div>
            <p className="text-[12px] text-amber-50/90 whitespace-pre-wrap leading-relaxed">{assemblyHint}</p>
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => send(ASSEMBLY_STEP1)} className="text-left text-xs bg-panel/80 border border-border rounded-lg px-2.5 py-2 hover:border-brand">
                Step 1: {ASSEMBLY_STEP1}
              </button>
              <button type="button" onClick={() => send(ASSEMBLY_STEP2)} className="text-left text-xs bg-panel/80 border border-border rounded-lg px-2.5 py-2 hover:border-brand">
                Step 2: {ASSEMBLY_STEP2}
              </button>
            </div>
          </div>
        )}

        {lastDesign && !streaming && (
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-3 mr-1">
            <div className="flex items-center gap-2 min-w-0">
              <Box className="w-4 h-4 text-brand-muted shrink-0" />
              <span className="text-sm font-medium text-white truncate">
                {SKILL_LABELS[lastDesign.skill || 'cad'] || 'Design'} saved
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1 font-mono truncate">{lastDesign.name}</p>
          </div>
        )}

        {(streaming || agentSteps.length > 0) && (
          <div className="rounded-xl border border-border bg-panel/40 p-3 mr-1">
            <div className="text-[10px] uppercase text-brand-muted font-semibold mb-2 flex items-center gap-2">
              {streaming && <Loader2 className="w-3 h-3 animate-spin" />}
              Build activity
              {phaseLabel && <span className="text-muted normal-case font-normal">· {phaseLabel}</span>}
            </div>
            <ul className="space-y-1 max-h-36 overflow-y-auto">
              {agentSteps.slice(-10).map((step, i) => (
                <li key={`${i}-${step.message}`} className="text-[11px] text-white/70 leading-snug">
                  {step.skill && step.skill !== 'agent' && (
                    <span className="text-brand-muted mr-1">[{SKILL_LABELS[step.skill] || step.skill}]</span>
                  )}
                  {step.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border bg-[#0a1628] shrink-0">
        <div className="rounded-xl border border-border bg-panel/60 focus-within:border-brand transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Describe your part, assembly, robot, or modification…"
            rows={3}
            className="w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm text-white placeholder:text-muted focus:outline-none"
            disabled={streaming}
          />
          <div className="flex items-center justify-between px-2 pb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button" className="p-1.5 text-muted hover:text-white" aria-label="Attach">
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleWebSearch}
                title="Web search for specs, standards, and product data"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  webSearch
                    ? 'bg-brand/25 border-brand text-brand-muted'
                    : 'border-border text-muted hover:text-white hover:border-brand/40'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Web
              </button>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  disabled={streaming || !models.length}
                  className="appearance-none text-[11px] border border-border rounded-md pl-2 pr-6 py-1 bg-panel text-white/80 cursor-pointer disabled:opacity-50 max-w-[130px]"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => send()}
              disabled={streaming || !input.trim() || !selectedModel}
              className="w-9 h-9 rounded-full bg-brand hover:bg-brand-hover text-white flex items-center justify-center disabled:opacity-40 shadow-md transition-colors"
              title={activeModel ? `Send with ${activeModel.label}` : 'Send'}
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted mt-2 px-1">
          We build what you describe — parts, assemblies, URDF, implicit shapes, and catalog imports.
          {webSearch && ' Web search is on for standards and reference data.'}
        </p>
      </div>
    </aside>
  );
}
