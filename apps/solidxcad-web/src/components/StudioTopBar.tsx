'use client';

import Link from 'next/link';
import { ArrowLeft, Bot, FolderTree, Settings } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { StudioPublishControls } from '@/components/StudioPublishControls';
import type { Project } from '@/lib/api';

type StudioTopBarProps = {
  projectId: string;
  project: Project | null;
  projectName: string;
  status?: string;
  showChat: boolean;
  showWorkspace: boolean;
  onToggleChat: () => void;
  onToggleWorkspace: () => void;
  onProjectChange: (project: Project) => void;
  onStatus: (msg: string) => void;
};

export function StudioTopBar({
  projectId,
  project,
  projectName,
  status,
  showChat,
  showWorkspace,
  onToggleChat,
  onToggleWorkspace,
  onProjectChange,
  onStatus,
}: StudioTopBarProps) {
  return (
    <header className="studio-topbar">
      <Link
        href="/dashboard"
        className="studio-topbar-icon-btn"
        title="Back to projects"
        aria-label="Back to projects"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      <BrandLogo href="/dashboard" size={28} className="shrink-0" />

      <span className="studio-topbar-title">{projectName}</span>

      {status && (
        <span className="studio-topbar-status hidden lg:inline">{status}</span>
      )}

      <div className="flex-1" />

      <StudioPublishControls
        projectId={projectId}
        project={project}
        onProjectChange={onProjectChange}
        onStatus={onStatus}
      />

      <div className="studio-topbar-actions">
        <button
          type="button"
          onClick={onToggleChat}
          className={`studio-topbar-pill${showChat ? ' is-active' : ''}`}
          title={showChat ? 'Hide agent' : 'Show agent'}
          aria-pressed={showChat}
        >
          <Bot className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Agent</span>
        </button>
        <button
          type="button"
          onClick={onToggleWorkspace}
          className={`studio-topbar-pill${showWorkspace ? ' is-active' : ''}`}
          title={showWorkspace ? 'Hide files' : 'Show files'}
          aria-pressed={showWorkspace}
        >
          <FolderTree className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Files</span>
        </button>
        <Link
          href="/settings"
          className="studio-topbar-icon-btn"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
