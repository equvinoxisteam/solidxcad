'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { ChatPanel } from '@/components/ChatPanel';
import { ModelViewer } from '@/components/ModelViewer';
import { ToolsPanel } from '@/components/ToolsPanel';
import { StudioTopBar } from '@/components/StudioTopBar';
import {
  api,
  getToken,
  setStoredUser,
  type CadResult,
  type ChatMessage,
  type Project,
  type ProjectFile,
} from '@/lib/api';
import type { ViewerSelectionContext } from '@/lib/viewerContext';
import { Loader2 } from 'lucide-react';
import { useClientUser } from '@/hooks/useClientUser';
import { subscribeAgentComplete } from '@/lib/agentRunner';
import { sanitizeUserError } from '@/lib/userFacingErrors';

const PANEL_CHAT_KEY = 'solidxcad_studio_chat_open';
const PANEL_WORKSPACE_KEY = 'solidxcad_studio_workspace_open';
const STUDIO_PANEL_MESSAGE_TYPE = 'solidxcad-studio-panel';
const VIEWER_CONTEXT_MESSAGE_TYPE = 'solidxcad-viewer-context';

function readPanelPref(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  if (v === '0') return false;
  if (v === '1') return true;
  return fallback;
}

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [highlightFile, setHighlightFile] = useState('');
  const [viewerContext, setViewerContext] = useState<ViewerSelectionContext | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [viewerReloadKey, setViewerReloadKey] = useState(0);
  const [panelsReady, setPanelsReady] = useState(false);
  useClientUser(true);

  useEffect(() => {
    setShowChat(readPanelPref(PANEL_CHAT_KEY, true));
    setShowWorkspace(readPanelPref(PANEL_WORKSPACE_KEY, false));
    setPanelsReady(true);
  }, []);

  function toggleChat() {
    setShowChat((v) => {
      const next = !v;
      localStorage.setItem(PANEL_CHAT_KEY, next ? '1' : '0');
      return next;
    });
  }

  function toggleWorkspace() {
    setShowWorkspace((v) => {
      const next = !v;
      localStorage.setItem(PANEL_WORKSPACE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const openChat = useCallback(() => {
    setShowChat(true);
    localStorage.setItem(PANEL_CHAT_KEY, '1');
  }, []);

  const openWorkspace = useCallback(() => {
    setShowWorkspace(true);
    localStorage.setItem(PANEL_WORKSPACE_KEY, '1');
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      if (data.type === VIEWER_CONTEXT_MESSAGE_TYPE) {
        setViewerContext({
          stepFile: data.stepFile,
          fileName: data.fileName,
          kind: data.kind,
          selectedParts: Array.isArray(data.selectedParts) ? data.selectedParts : [],
          selectedReferenceIds: Array.isArray(data.selectedReferenceIds) ? data.selectedReferenceIds : [],
          selectedReferences: Array.isArray(data.selectedReferences) ? data.selectedReferences : [],
        });
        if (data.fileName) setHighlightFile(String(data.fileName));
        return;
      }
      if (data.type !== STUDIO_PANEL_MESSAGE_TYPE) return;
      if (data.panel === 'agent') toggleChat();
      if (data.panel === 'workspace') toggleWorkspace();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [{ project: p }, { files: f }, { messages: m }, { user: me }] = await Promise.all([
        api.getProject(id),
        api.getFiles(id),
        api.getMessages(id),
        api.me(),
      ]);
      setProject(p);
      setFiles(f);
      setMessages(m);
      setStoredUser(me);
      api.syncViewerWorkspace(id).catch(() => {});
      return { messages: m, files: f };
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (raw.includes('log in') || raw.includes('Authentication') || raw.includes('401')) {
        router.push('/login');
        return;
      }
      if (raw.includes('not found') || raw.includes('404')) {
        router.push('/dashboard');
        return;
      }
      setStatus(sanitizeUserError(raw, 'load'));
      throw err;
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    refresh()
      .then((data) => {
        if (!data) return;
        if (!data.messages.length && readPanelPref(PANEL_CHAT_KEY, true)) {
          openChat();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, router, refresh, openChat]);

  async function refreshProjectFiles(expectedName = '') {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await api.syncViewerWorkspace(id).catch(() => null);
      const { files: f } = await api.getFiles(id);
      setFiles(f);
      if (!expectedName || f.some((file) => file.name === expectedName) || attempt >= 5) {
        return f;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    return [];
  }

  async function onCadGenerated(result: CadResult) {
    const labels: Record<string, string> = {
      cad: 'Solid model',
      urdf: 'URDF',
      srdf: 'SRDF',
      sdf: 'SDF',
      'implicit-cad': 'Implicit CAD',
      gcode: 'G-code',
      'step-parts': 'Catalog part',
      sendcutsend: 'SendCutSend',
    };
    const label = labels[result.skill || ''] || 'Design';
    if (result.deferred) {
      setStatus('Answer the assistant’s questions to continue building');
      openChat();
      return;
    }
    if (result.ok) {
      const note = result.repaired ? ' (refined automatically)' : '';
      const cadName = result.file?.name;
      setStatus(`✓ ${label}: ${cadName || 'saved'}${note}`);
      setHighlightFile(cadName || '');
      openChat();
      if (cadName) openWorkspace();
      try {
        await refreshProjectFiles(cadName || '');
        setViewerReloadKey((k) => k + 1);
      } catch {
        refresh().catch(() => {});
      }
    } else {
      setStatus('Refining the design — try again or adjust your prompt');
      openChat();
    }
  }

  useEffect(() => {
    return subscribeAgentComplete((projectId, payload) => {
      if (projectId !== id || !payload?.cadResult) return;
      refresh().catch(() => {});
      if (!payload.cadResult.deferred && payload.cadResult.ok) {
        const cadName = payload.cadResult.file?.name;
        setHighlightFile(cadName || '');
        setViewerReloadKey((k) => k + 1);
        if (cadName) openWorkspace();
      }
    });
  }, [id, refresh, openWorkspace]);

  if (loading) {
    return (
      <div className="min-h-screen studio-scene flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  const layoutClass = [
    'studio-layout',
    panelsReady && showChat ? 'studio-layout-chat-open' : '',
    panelsReady && showWorkspace ? 'studio-layout-workspace-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="h-screen studio-scene flex flex-col overflow-hidden">
      <StudioTopBar
        projectId={id}
        project={project}
        projectName={project?.name || 'Untitled'}
        status={status}
        showChat={showChat}
        showWorkspace={showWorkspace}
        onToggleChat={toggleChat}
        onToggleWorkspace={toggleWorkspace}
        onProjectChange={setProject}
        onStatus={setStatus}
      />

      <div className={layoutClass}>
        <aside
          className={`studio-chat-column${showChat ? ' is-open' : ''}`}
          aria-label="CAD Agent"
          aria-hidden={!showChat}
        >
          <div className="studio-column-header">
            <p className="studio-column-title">CAD Agent</p>
            <button
              type="button"
              className="studio-column-close lg:hidden"
              onClick={toggleChat}
              aria-label="Close agent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="studio-column-body">
            <ChatPanel
              projectId={id}
              messages={messages}
              projectFiles={files}
              onMessagesChange={refresh}
              onCadGenerated={onCadGenerated}
              embedded
              viewerContext={viewerContext}
              activeFileName={highlightFile}
            />
          </div>
        </aside>

        <main className="studio-viewer-column">
          <ModelViewer
            projectId={id}
            files={files}
            highlightFile={highlightFile}
            viewerReloadKey={viewerReloadKey}
          />
        </main>

        <aside
          className={`studio-workspace-column${showWorkspace ? ' is-open' : ''}`}
          aria-label="Workspace files"
          aria-hidden={!showWorkspace}
        >
          <div className="studio-column-header">
            <p className="studio-column-title">Workspace</p>
            <button
              type="button"
              className="studio-column-close lg:hidden"
              onClick={toggleWorkspace}
              aria-label="Close workspace"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="studio-column-body">
            <ToolsPanel
              projectId={id}
              project={project}
              files={files}
              highlightFile={highlightFile}
              onRefresh={() => refresh().catch(() => {})}
              onStatus={setStatus}
              onHighlightFile={setHighlightFile}
              onProjectChange={setProject}
              embedded
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
