'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  Box,
  ChevronDown,
  Globe,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  api,
  getStoredChatModel,
  getStoredModelAuto,
  getStoredWebSearch,
  setStoredChatModel,
  setStoredModelAuto,
  setStoredWebSearch,
  streamChat,
} from '@/lib/api';
import type { CadResult, ChatMessage, ChatModel, ProjectFile } from '@/lib/api';
import {
  isUserVisibleFile,
  resolveMentionedFileIds,
  sanitizeAssistantForDisplay,
  stripFileReferencesFromDisplay,
} from '@/lib/agentDisplay';

type AgentStep = { message: string; skill?: string; status?: string };
type AgentPhase =
  | 'idle'
  | 'reading'
  | 'thinking'
  | 'planning'
  | 'exploring'
  | 'asking'
  | 'executing'
  | 'waiting'
  | 'searching';

type GeneratedItem = { id: string; skill?: string; label: string };

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
  exploring: 'Exploring files',
  asking: 'Clarifying',
  waiting: 'Waiting for you',
  executing: 'Generating',
  running: 'Generating',
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

function activityLabel(msg: string) {
  const cleaned = stripFileReferencesFromDisplay(msg).trim();
  return cleaned || 'Working…';
}

function friendlyError() {
  return 'Adjusting approach — resend your message or try a simpler prompt.';
}

export function ChatPanel({
  projectId,
  messages,
  projectFiles = [],
  onMessagesChange,
  onCadGenerated,
}: {
  projectId: string;
  messages: ChatMessage[];
  projectFiles?: ProjectFile[];
  onMessagesChange: () => void;
  onCadGenerated: (result: CadResult) => void;
}) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [liveReply, setLiveReply] = useState('');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelAuto, setModelAuto] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [assemblyHint, setAssemblyHint] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [modelUsedLabel, setModelUsedLabel] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mentionableFiles = useMemo(
    () => projectFiles.filter((f) => isUserVisibleFile(f.name, f.kind)),
    [projectFiles],
  );

  const filteredMentions = useMemo(() => {
    const q = mentionFilter.toLowerCase();
    if (!q) return mentionableFiles.slice(0, 8);
    return mentionableFiles.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionFilter, mentionableFiles]);

  useEffect(() => {
    setWebSearch(getStoredWebSearch());
    setModelAuto(getStoredModelAuto());
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
        setSelectedModel(
          stored && FALLBACK_MODELS.some((m) => m.id === stored)
            ? stored
            : FALLBACK_MODELS[0].id,
        );
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveReply, agentSteps, agentPhase, generatedItems]);

  function onModelChange(modelId: string) {
    setSelectedModel(modelId);
    setStoredChatModel(modelId);
  }

  function toggleModelAuto() {
    setModelAuto((v) => {
      const next = !v;
      setStoredModelAuto(next);
      return next;
    });
  }

  function toggleWebSearch() {
    setWebSearch((v) => {
      const next = !v;
      setStoredWebSearch(next);
      return next;
    });
  }

  function onInputChange(value: string) {
    setInput(value);
    const atMatch = value.match(/@([^\s@]*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionFilter(atMatch[1] || '');
    } else {
      setMentionOpen(false);
      setMentionFilter('');
    }
  }

  function insertMention(file: ProjectFile) {
    const replaced = input.replace(/@([^\s@]*)$/, `@${file.name} `);
    setInput(replaced);
    setMentionOpen(false);
    setMentionFilter('');
    textareaRef.current?.focus();
  }

  function onImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 4_000_000) {
      setAgentSteps((s) => [...s, { message: 'Image too large — use under 4 MB', skill: 'agent' }]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function send(message?: string) {
    const rawText = (message || input).trim();
    const imageDataUrl = imagePreview || '';
    if ((!rawText && !imageDataUrl) || streaming || (!modelAuto && !selectedModel)) return;

    const text = rawText
      || 'Build a CAD model matching the attached reference image. Estimate dimensions from the image and generate STEP and STL.';

    const contextFileIds = resolveMentionedFileIds(text, mentionableFiles);

    setInput('');
    setImagePreview(null);
    setStreaming(true);
    setLiveReply('');
    setAgentSteps([]);
    setAgentPhase(webSearch ? 'searching' : 'reading');
    setAssemblyHint(null);
    setModelUsedLabel('');

    await streamChat(
      projectId,
      text,
      modelAuto ? 'auto' : selectedModel,
      webSearch,
      (delta) => {
        setAgentPhase((p) => (p === 'searching' || p === 'reading' ? 'thinking' : p));
        setLiveReply((s) => s + delta);
      },
      ({ cadResult, pipelineDeferred, reply, modelUsed, webSearchUsed }) => {
        setStreaming(false);
        setLiveReply('');
        setAgentPhase(pipelineDeferred ? 'waiting' : 'idle');
        if (modelUsed) {
          const label = models.find((m) => m.id === modelUsed)?.label || modelUsed;
          setModelUsedLabel(label);
        }
        if (webSearchUsed && !webSearch) {
          setAgentSteps((steps) => [
            ...steps,
            { message: 'Auto-enabled web search for this request', skill: 'agent', status: 'searching' },
          ]);
        }
        if (reply) {
          setAgentSteps((steps) => [
            ...steps,
            { message: sanitizeAssistantForDisplay(reply).slice(0, 280), skill: 'agent', status: 'done' },
          ]);
        }
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
          const skill = cadResult.skill || 'cad';
          const label = SKILL_LABELS[skill] || 'Design';
          setGeneratedItems((prev) => [
            { id: `${Date.now()}-${skill}`, skill, label: `${label} saved to workspace` },
            ...prev,
          ].slice(0, 8));
          onCadGenerated(cadResult);
        }
      },
      () => {
        setStreaming(false);
        setLiveReply('');
        setAgentPhase('idle');
        setAgentSteps((steps) => [...steps, { message: friendlyError(), skill: 'agent', status: 'running' }]);
        onMessagesChange();
      },
      (msg, skill, status) => {
        if (status === 'planning') setAgentPhase('planning');
        else if (status === 'exploring') setAgentPhase('exploring');
        else if (status === 'asking') setAgentPhase('asking');
        else if (status === 'running' || status === 'done') setAgentPhase('executing');
        setAgentSteps((steps) => [...steps, { message: activityLabel(msg), skill, status }]);
      },
      (phase, msg) => {
        setAgentPhase(phase as AgentPhase);
        setAgentSteps((steps) => [...steps, { message: activityLabel(msg), skill: 'agent', status: phase }]);
      },
      {
        contextFileIds,
        imageDataUrl,
        modelMode: modelAuto ? 'auto' : 'manual',
      },
    );
  }

  const phaseLabel = PHASE_LABELS[agentPhase] || '';
  const showLiveThinking = streaming && !sanitizeAssistantForDisplay(liveReply);

  return (
    <aside className="w-full lg:w-[380px] border-0 lg:border-l border-border bg-[#0d1a30] flex flex-col shrink-0 flex-1 min-h-0">
      <div className="bg-gradient-to-r from-brand to-brand-light text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="font-semibold text-sm">Agent</div>
        <span className="text-[10px] font-medium bg-white/15 px-2 py-0.5 rounded-full flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${streaming ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'}`}
          />
          {streaming ? phaseLabel || 'Working' : 'Ready'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {!messages.length && !streaming && (
          <div className="space-y-3">
            <p className="text-xs text-white/80 leading-relaxed">
              Describe parts, assemblies, robots (URDF/SRDF/SDF), or attach an image. Use{' '}
              <span className="text-brand-muted">@filename</span> to target a workspace file.
            </p>
            <p className="text-[11px] text-muted">Try a prompt:</p>
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
            <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90">
              {m.role === 'assistant' ? sanitizeAssistantForDisplay(m.content) : m.content}
            </div>
          </div>
        ))}

        {showLiveThinking && (
          <div className="text-sm rounded-xl p-3 bg-panel/50 border border-border mr-1">
            <div className="text-[10px] uppercase text-brand-muted font-semibold mb-1.5">SolidX Assistant</div>
            <div className="whitespace-pre-wrap break-words text-[13px] text-white/90">
              {sanitizeAssistantForDisplay(liveReply)}
            </div>
          </div>
        )}

        {assemblyHint && !streaming && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mr-1 space-y-2">
            <div className="text-[10px] uppercase text-amber-200 font-semibold">Assembly workflow</div>
            <p className="text-[12px] text-amber-50/90 whitespace-pre-wrap leading-relaxed">{assemblyHint}</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => send(ASSEMBLY_STEP1)}
                className="text-left text-xs bg-panel/80 border border-border rounded-lg px-2.5 py-2 hover:border-brand"
              >
                Step 1: {ASSEMBLY_STEP1}
              </button>
              <button
                type="button"
                onClick={() => send(ASSEMBLY_STEP2)}
                className="text-left text-xs bg-panel/80 border border-border rounded-lg px-2.5 py-2 hover:border-brand"
              >
                Step 2: {ASSEMBLY_STEP2}
              </button>
            </div>
          </div>
        )}

        {generatedItems.length > 0 && (
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-3 mr-1 space-y-2">
            <div className="text-[10px] uppercase text-brand-muted font-semibold">Generated</div>
            <ul className="space-y-1.5">
              {generatedItems.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-[12px] text-white/90 min-w-0">
                  <Box className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                  <span className="truncate">{g.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(streaming || agentSteps.length > 0) && (
          <div className="rounded-xl border border-border bg-panel/40 p-3 mr-1">
            <div className="text-[10px] uppercase text-brand-muted font-semibold mb-2 flex items-center gap-2 flex-wrap">
              {streaming && <Loader2 className="w-3 h-3 animate-spin" />}
              Agent activity
              {phaseLabel && <span className="text-muted normal-case font-normal">· {phaseLabel}</span>}
              {modelUsedLabel && (
                <span className="text-muted normal-case font-normal">· {modelUsedLabel}</span>
              )}
            </div>
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {agentSteps.slice(-12).map((step, i) => (
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

      <div className="p-3 border-t border-border bg-[#0a1628] shrink-0 relative">
        {mentionOpen && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-border bg-panel shadow-lg max-h-40 overflow-y-auto z-10">
            <div className="text-[10px] uppercase text-muted px-2 py-1.5 border-b border-border flex items-center gap-1">
              <AtSign className="w-3 h-3" /> Attach file context
            </div>
            {filteredMentions.map((f) => (
              <button
                key={f._id}
                type="button"
                onClick={() => insertMention(f)}
                className="w-full text-left px-2.5 py-2 text-[12px] hover:bg-brand/15 text-white/90 truncate"
              >
                @{f.name}
              </button>
            ))}
          </div>
        )}

        {imagePreview && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-panel/60 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Reference" className="h-12 w-12 object-cover rounded" />
            <span className="text-[11px] text-muted flex-1">Reference image attached</span>
            <button type="button" onClick={() => setImagePreview(null)} className="text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-panel/60 focus-within:border-brand transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Describe your part… use @ to pick a file"
            rows={3}
            className="w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm text-white placeholder:text-muted focus:outline-none"
            disabled={streaming}
          />
          <div className="flex items-center justify-between px-2 pb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImagePick}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-muted hover:text-white"
                aria-label="Attach image"
                title="Attach reference image for CAD"
              >
                <ImagePlus className="w-4 h-4" />
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
              <button
                type="button"
                onClick={toggleModelAuto}
                title="Auto picks the best model for your request"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  modelAuto
                    ? 'bg-brand/25 border-brand text-brand-muted'
                    : 'border-border text-muted hover:text-white hover:border-brand/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Auto
              </button>
              {!modelAuto && (
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value)}
                    disabled={streaming || !models.length}
                    className="appearance-none text-[11px] border border-border rounded-md pl-2 pr-6 py-1 bg-panel text-white/80 cursor-pointer disabled:opacity-50 max-w-[130px]"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => send()}
              disabled={streaming || (!input.trim() && !imagePreview) || (!modelAuto && !selectedModel)}
              className="w-9 h-9 rounded-full bg-brand hover:bg-brand-hover text-white flex items-center justify-center disabled:opacity-40 shadow-md transition-colors"
              title="Send to agent"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted mt-2 px-1 leading-relaxed">
          Code runs in the background — chat shows activity and generated files only.
          {webSearch && ' Web search is on.'}
          {modelAuto && ' Auto model is on.'}
        </p>
      </div>
    </aside>
  );
}
