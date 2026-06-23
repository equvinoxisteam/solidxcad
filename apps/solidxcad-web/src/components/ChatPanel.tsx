'use client';

import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  AtSign,
  Bot,
  ImagePlus,
  Loader2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { streamChat } from '@/lib/api';
import type { CadResult, ChatMessage, ProjectFile } from '@/lib/api';
import {
  formatWorkingStatus,
  isUserVisibleFile,
  looksLikeGeneratorCode,
  parseChatError,
  resolveMentionedFileIds,
  sanitizeAssistantForDisplay,
  INSUFFICIENT_CREDITS_ERROR,
} from '@/lib/agentDisplay';
import { USER_ERRORS } from '@/lib/userFacingErrors';
import {
  buildSelectionContextText,
  resolveViewerFileId,
  type ViewerSelectionContext,
} from '@/lib/viewerContext';

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

const PROMPTS = [
  '30mm cube with 4× M3 holes',
  'Build a 6-axis robot arm URDF',
  'Flow reactor for hydrogenation — build with defaults',
];

const PHASE_LABELS: Record<string, string> = {
  reading: 'Reading workspace',
  thinking: 'Designing',
  planning: 'Planning',
  exploring: 'Exploring files',
  asking: 'Clarifying',
  waiting: 'Waiting for you',
  executing: 'Generating files',
  running: 'Generating files',
  searching: 'Searching references',
};

const CHAT_MODEL = 'anthropic/claude-opus-4.7';

const ASSEMBLY_STEP1 = 'Import M3 socket head cap screw from step.parts';
const ASSEMBLY_STEP2 =
  'Assembly: 50×30×5 mm mount plate with 4 corner holes and the imported screws at each hole.';

function extractPlanSteps(text: string): string[] {
  const match = text.match(/\[AGENT_PLAN\]([\s\S]*?)\[\/AGENT_PLAN\]/i);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\).\]]\s*/, '').trim())
    .filter((line) => line && !line.startsWith('['));
}

function renderAssistantText(text: string) {
  const body = sanitizeAssistantForDisplay(text);
  return body.split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={`br-${index}`} />;
    if (trimmed.startsWith('• ')) {
      return (
        <p key={index} className="chat-bullet-line">
          {trimmed.slice(2)}
        </p>
      );
    }
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={index} className="chat-text-line">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  });
}

function AgentWorkingStrip({
  label,
  phaseLabel,
  planSteps,
}: {
  label: string;
  phaseLabel: string;
  planSteps: string[];
}) {
  return (
    <div className="chat-working-strip">
      <div className="chat-working-strip-row">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="chat-working-title">{label || phaseLabel || 'Working…'}</p>
          {phaseLabel && label && phaseLabel !== label && (
            <p className="chat-working-sub">{phaseLabel}</p>
          )}
        </div>
      </div>
      {planSteps.length > 0 && (
        <ol className="chat-working-plan">
          {planSteps.slice(0, 5).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SuggestionChips({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="chat-suggestions">
      <p className="chat-suggestions-label">
        <Sparkles className="w-3 h-3" aria-hidden />
        Suggested next steps
      </p>
      <div className="chat-suggestions-list">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="chat-suggestion-chip"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatStatusBadge({ streaming, phaseLabel }: { streaming: boolean; phaseLabel: string }) {
  return (
    <span className="text-[10px] font-medium text-muted flex items-center gap-1.5">
      <span
        className={`chat-status-dot ${streaming ? 'chat-status-dot-live' : 'chat-status-dot-ready'}`}
      />
      {streaming ? phaseLabel || 'Working' : 'Ready'}
    </span>
  );
}

export function ChatPanel({
  projectId,
  messages,
  projectFiles = [],
  onMessagesChange,
  onCadGenerated,
  embedded = false,
  viewerContext = null,
  activeFileName = '',
}: {
  projectId: string;
  messages: ChatMessage[];
  projectFiles?: ProjectFile[];
  onMessagesChange: () => void;
  onCadGenerated: (result: CadResult) => void;
  embedded?: boolean;
  viewerContext?: ViewerSelectionContext | null;
  activeFileName?: string;
}) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [liveReply, setLiveReply] = useState('');
  const [pendingUser, setPendingUser] = useState('');
  const [workingStatus, setWorkingStatus] = useState('');
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [assemblyHint, setAssemblyHint] = useState<string | null>(null);
  const [creditsBlocked, setCreditsBlocked] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
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

  const phaseLabel = PHASE_LABELS[agentPhase] || '';
  const displayLiveReply = sanitizeAssistantForDisplay(liveReply);
  const hideCodeStream = looksLikeGeneratorCode(liveReply)
    || agentPhase === 'executing'
    || agentPhase === 'planning';
  const showLiveBubble = streaming && Boolean(displayLiveReply) && !hideCodeStream;
  const planSteps = useMemo(() => extractPlanSteps(liveReply), [liveReply]);
  const selectionSummary = useMemo(
    () => buildSelectionContextText(viewerContext),
    [viewerContext],
  );
  const viewerFileId = useMemo(
    () => resolveViewerFileId(projectFiles, viewerContext),
    [projectFiles, viewerContext],
  );

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, displayLiveReply, workingStatus, streaming, assemblyHint, selectionSummary, followUpSuggestions, pendingUser, streamError]);

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
      setStreamError('Image too large — use under 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function updateWorking(message: string, status?: string) {
    const formatted = formatWorkingStatus(message, status);
    if (formatted) setWorkingStatus(formatted);
  }

  async function send(message?: string) {
    const rawText = (message || input).trim();
    const imageDataUrl = imagePreview || '';
    if ((!rawText && !imageDataUrl) || streaming) return;

    const text = rawText
      || 'Analyze the attached image and build the correct SolidX CAD output (CAD STEP, URDF, SDF, implicit, or parts import as appropriate). Estimate dimensions from the image.';

    const contextFileIds = resolveMentionedFileIds(text, mentionableFiles);

    setInput('');
    setImagePreview(null);
    setPendingUser(text);
    setStreaming(true);
    setLiveReply('');
    setWorkingStatus('Reading workspace…');
    setAgentPhase('reading');
    setAssemblyHint(null);
    setCreditsBlocked(false);
    setStreamError('');
    setFollowUpSuggestions([]);

    await streamChat(
      projectId,
      text,
      CHAT_MODEL,
      (delta) => {
        setAgentPhase((p) => (p === 'searching' || p === 'reading' ? 'thinking' : p));
        setLiveReply((s) => s + delta);
      },
      ({ cadResult, pipelineDeferred, suggestions, reply }) => {
        setStreaming(false);
        setLiveReply('');
        setPendingUser('');
        setWorkingStatus('');
        setAgentPhase(pipelineDeferred ? 'waiting' : 'idle');
        if (suggestions?.length) setFollowUpSuggestions(suggestions);
        onMessagesChange();
        if (cadResult?.hint === 'assembly_needs_parts') {
          setAssemblyHint(cadResult.hintMessage || null);
        } else if (pipelineDeferred) {
          setFollowUpSuggestions((prev) => prev.length ? prev : [
            'Use standard engineering defaults and build it',
            'Proceed — no more questions',
          ]);
        } else if (cadResult && !cadResult.deferred && cadResult.ok) {
          onCadGenerated(cadResult);
        } else if (cadResult && !cadResult.ok) {
          setFollowUpSuggestions((prev) => prev.length ? prev : [
            'Retry with simpler geometry',
            'Use defaults and build again',
          ]);
        }
        if (reply && pipelineDeferred) {
          // suggestions already set from server
        }
      },
      (err) => {
        const parsed = parseChatError(err);
        setStreaming(false);
        setLiveReply('');
        setPendingUser('');
        setWorkingStatus('');
        if (parsed.code === INSUFFICIENT_CREDITS_ERROR) {
          setCreditsBlocked(true);
          setAgentPhase('idle');
          setStreamError(parsed.message);
          return;
        }
        setAgentPhase('idle');
        setStreamError(parsed.message || USER_ERRORS.chat);
        setFollowUpSuggestions([
          'Try again',
          'Use standard defaults and build it',
          'Simplify the design',
        ]);
        onMessagesChange();
      },
      (msg, skill, status) => {
        if (status === 'planning') setAgentPhase('planning');
        else if (status === 'exploring') setAgentPhase('exploring');
        else if (status === 'asking') setAgentPhase('asking');
        else if (status === 'running' || status === 'done') setAgentPhase('executing');
        else if (status === 'error') setAgentPhase('executing');
        updateWorking(msg, status);
      },
      (phase, msg) => {
        setAgentPhase(phase as AgentPhase);
        updateWorking(msg, phase);
      },
      {
        contextFileIds,
        imageDataUrl,
        modelMode: 'manual',
        selectionContext: selectionSummary,
        viewerFileId,
      },
    );
  }

  const showWorkingStrip = streaming && !showLiveBubble;

  return (
    <aside
      className={`chat-panel ${
        embedded ? 'w-full h-full' : 'w-full lg:w-[380px] border-0 lg:border-l border-border shrink-0 flex-1 min-h-0'
      }`}
    >
      {!embedded ? (
        <div className="bg-brand text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="font-semibold text-sm">Agent</div>
          <ChatStatusBadge streaming={streaming} phaseLabel={phaseLabel} />
        </div>
      ) : (
        <div className="chat-panel-embedded-header">
          <span className="text-xs font-semibold text-gray-700">Agent</span>
          <ChatStatusBadge streaming={streaming} phaseLabel={phaseLabel} />
        </div>
      )}

      <div ref={threadRef} className="chat-thread">
        {(viewerContext?.selectedReferences?.length ?? 0) > 0 && (
          <div className="chat-viewer-context">
            <p className="chat-viewer-context-label">3D selection</p>
            <p className="chat-viewer-context-text whitespace-pre-wrap">{selectionSummary}</p>
            <p className="chat-viewer-context-hint">
              Your next message applies to this selection — e.g. add holes, fillet, or cut features.
            </p>
          </div>
        )}

        {creditsBlocked && (
          <div className="chat-credits-banner">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="m-0 font-medium text-sm text-gray-900">Out of design credits</p>
              <p className="m-0 text-xs text-muted mt-0.5">
                Add credits or upgrade to Pro to keep building models, robots, and toolpaths.
              </p>
            </div>
            <Link href="/pricing" className="chat-credits-cta">
              Add credits
            </Link>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m._id} className="chat-row chat-row-user">
              <div className="chat-avatar chat-avatar-user">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="chat-bubble chat-bubble-user">
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            </div>
          ) : (
            <div key={m._id} className="chat-row chat-row-assistant">
              <div className="chat-avatar chat-avatar-assistant">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="chat-bubble chat-bubble-assistant">
                <div className="chat-message-body">{renderAssistantText(m.content)}</div>
              </div>
            </div>
          ),
        )}

        {pendingUser && streaming && (
          <div className="chat-row chat-row-user">
            <div className="chat-avatar chat-avatar-user">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="chat-bubble chat-bubble-user">
              <div className="whitespace-pre-wrap break-words">{pendingUser}</div>
            </div>
          </div>
        )}

        {!messages.length && !streaming && !pendingUser && (
          <div className="chat-empty-state">
            <p className="chat-empty-title">What should we build?</p>
            <p className="chat-empty-desc">
              Describe a part, assembly, or robot. I&apos;ll plan, generate files, and show them in the viewer.
            </p>
            <div className="flex flex-col gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="chat-starter-chip"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {showLiveBubble && (
          <div className="chat-row chat-row-assistant">
            <div className="chat-avatar chat-avatar-assistant">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="chat-bubble chat-bubble-assistant">
              <div className="chat-message-body">{renderAssistantText(liveReply)}</div>
            </div>
          </div>
        )}

        {showWorkingStrip && (
          <AgentWorkingStrip
            label={workingStatus}
            phaseLabel={phaseLabel}
            planSteps={planSteps}
          />
        )}

        {streamError && !streaming && (
          <div className="chat-row chat-row-assistant">
            <div className="chat-avatar chat-avatar-assistant">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="chat-bubble chat-bubble-assistant chat-bubble-error">
              <p className="m-0 text-sm text-gray-800">{streamError}</p>
            </div>
          </div>
        )}

        {assemblyHint && !streaming && (
          <div className="chat-assembly-hint">
            <div className="chat-assembly-hint-title">Assembly workflow</div>
            <p>{assemblyHint}</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => send(ASSEMBLY_STEP1)}
                className="text-left text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-2 hover:border-brand text-gray-800"
              >
                Step 1: {ASSEMBLY_STEP1}
              </button>
              <button
                type="button"
                onClick={() => send(ASSEMBLY_STEP2)}
                className="text-left text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-2 hover:border-brand text-gray-800"
              >
                Step 2: {ASSEMBLY_STEP2}
              </button>
            </div>
          </div>
        )}

        {!streaming && followUpSuggestions.length > 0 && (
          <SuggestionChips
            suggestions={followUpSuggestions}
            onPick={(s) => send(s)}
            disabled={streaming}
          />
        )}
      </div>

      <div className="p-3 border-t border-border bg-elevated shrink-0 relative">
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
                className="w-full text-left px-2.5 py-2 text-[12px] hover:bg-brand/10 text-gray-800 truncate"
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
            <button type="button" onClick={() => setImagePreview(null)} className="text-muted hover:text-gray-900">
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
            className="w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm text-gray-900 placeholder:text-muted focus:outline-none"
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
                className="p-1.5 text-muted hover:text-gray-900"
                aria-label="Attach image"
                title="Attach image"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => send()}
              disabled={streaming || creditsBlocked || (!input.trim() && !imagePreview)}
              className="w-9 h-9 rounded-full bg-brand hover:bg-brand-hover text-white flex items-center justify-center disabled:opacity-40 shadow-md transition-colors"
              title="Send to agent"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
