'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatPanel } from '@/components/ChatPanel';
import { ModelViewer } from '@/components/ModelViewer';
import { ToolsPanel } from '@/components/ToolsPanel';
import { StudioTopBar, type StudioViewMode } from '@/components/StudioTopBar';
import {
  api,
  getToken,
  setStoredUser,
  type CadResult,
  type ChatMessage,
  type Project,
  type ProjectFile,
} from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useClientUser } from '@/hooks/useClientUser';
import { USER_ERROR_LOAD_PROJECT } from '@/lib/userMessages';

const PANEL_CHAT_KEY = 'solidxcad_studio_chat_open';
const PANEL_WORKSPACE_KEY = 'solidxcad_studio_workspace_open';

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
  const [viewMode, setViewMode] = useState<StudioViewMode>('viewer');
  const [showChat, setShowChat] = useState(true);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const { user, mounted } = useClientUser(true);

  useEffect(() => {
    setShowChat(readPanelPref(PANEL_CHAT_KEY, true));
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
      if (!showWorkspace && cadName) setShowWorkspace(true);
      if (cadName && (result.skill === 'cad' || result.skill === 'urdf' || !result.skill)) {
        setViewMode('viewer');
      }
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="h-screen studio-scene flex flex-col overflow-hidden">
      <StudioTopBar
        projectId={id}
        projectName={project?.name || 'Untitled'}
        status={status}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showChat={showChat}
        onToggleChat={toggleChat}
        showWorkspace={showWorkspace}
        onToggleWorkspace={toggleWorkspace}
        user={mounted ? user : null}
        onDeleted={() => router.push('/dashboard')}
      />

      <div className={`studio-main flex-1 min-h-0 ${showChat || showWorkspace ? 'chat-open' : ''}`}>
        {(showChat || showWorkspace) && (
          <button
            type="button"
            className="studio-mobile-backdrop lg:hidden"
            aria-label="Close panel"
            onClick={() => {
              if (showChat) toggleChat();
              else if (showWorkspace) toggleWorkspace();
            }}
          />
        )}

        <div className="studio-viewer-pane">
          <ModelViewer
            projectId={id}
            files={files}
            mode={viewMode}
            onModeChange={setViewMode}
          />
        </div>

        {showWorkspace && (
          <div className="studio-workspace-pane">
            <ToolsPanel
              projectId={id}
              files={files}
              highlightFile={highlightFile}
              onRefresh={() => refresh().catch(() => {})}
              onStatus={setStatus}
              onHighlightFile={setHighlightFile}
            />
          </div>
        )}

        {showChat && (
          <div className="studio-chat-pane">
            <ChatPanel
              projectId={id}
              messages={messages}
              projectFiles={files}
              onMessagesChange={refresh}
              onCadGenerated={onCadGenerated}
            />
          </div>
        )}
      </div>
    </div>
  );
}
