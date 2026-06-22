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
import { USER_ERROR_LOAD_PROJECT } from '@/lib/userMessages';

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
  const [showChat, setShowChat] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  useClientUser(true);

  useEffect(() => {
    setShowChat(readPanelPref(PANEL_CHAT_KEY, false));
    setShowWorkspace(readPanelPref(PANEL_WORKSPACE_KEY, false));
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
        });
        if (data.fileName) setHighlightFile(String(data.fileName));
        return;
      }
      if (data.type !== STUDIO_PANEL_MESSAGE_TYPE) return;
      if (data.panel === 'agent') {
        setShowChat((open) => {
          const next = !open;
          localStorage.setItem(PANEL_CHAT_KEY, next ? '1' : '0');
          return next;
        });
      }
      if (data.panel === 'workspace') {
        setShowWorkspace((open) => {
          const next = !open;
          localStorage.setItem(PANEL_WORKSPACE_KEY, next ? '1' : '0');
          return next;
        });
      }
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load project';
      if (msg.includes('log in') || msg.includes('Authentication') || msg.includes('401')) {
        router.push('/login');
        return;
      }
      if (msg.includes('not found') || msg.includes('404')) {
        router.push('/dashboard');
        return;
      }
      setStatus(USER_ERROR_LOAD_PROJECT);
      throw err;
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, router, refresh]);

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
      return;
    }
    if (result.ok) {
      const note = result.repaired ? ' (refined automatically)' : '';
      const cadName = result.file?.name;
      setStatus(`✓ ${label}: ${cadName || 'saved'}${note}`);
      setHighlightFile(cadName || '');
      if (!showWorkspace && cadName) openWorkspace();
      try {
        const [{ files: f }] = await Promise.all([
          api.getFiles(id),
          api.syncViewerWorkspace(id).catch(() => null),
        ]);
        setFiles(f);
      } catch {
        refresh().catch(() => {});
      }
    } else {
      setStatus('Refining the design — try again or adjust your prompt');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen studio-scene flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="h-screen studio-scene flex flex-col overflow-hidden">
      <StudioTopBar
        projectName={project?.name || 'Untitled'}
        status={status}
      />

      <div className="studio-embed-shell flex-1 min-h-0">
        <ModelViewer projectId={id} files={files} />

        {showWorkspace && (
          <div className="studio-embed-panel studio-embed-panel-workspace">
            <div className="studio-embed-panel-header">
              <p className="studio-embed-panel-title">Workspace files</p>
              <button
                type="button"
                className="studio-embed-panel-close"
                onClick={toggleWorkspace}
                aria-label="Close workspace files"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="studio-embed-panel-body">
              <ToolsPanel
                projectId={id}
                files={files}
                highlightFile={highlightFile}
                onRefresh={() => refresh().catch(() => {})}
                onStatus={setStatus}
                onHighlightFile={setHighlightFile}
                embedded
              />
            </div>
          </div>
        )}

        {showChat && (
          <div className="studio-embed-panel studio-embed-panel-agent">
            <div className="studio-embed-panel-header">
              <p className="studio-embed-panel-title">CAD Agent</p>
              <button
                type="button"
                className="studio-embed-panel-close"
                onClick={toggleChat}
                aria-label="Close agent"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="studio-embed-panel-body">
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
          </div>
        )}

      </div>
    </div>
  );
}
