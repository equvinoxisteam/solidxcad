'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Box,
  FolderTree,
  MessageSquare,
  Monitor,
  Settings,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { formatCredits } from '@/lib/api';
import type { User } from '@/lib/api';

export type StudioViewMode = 'mesh' | 'viewer';

type StudioTopBarProps = {
  projectId: string;
  projectName: string;
  status?: string;
  viewMode: StudioViewMode;
  onViewModeChange: (mode: StudioViewMode) => void;
  showChat: boolean;
  onToggleChat: () => void;
  showWorkspace: boolean;
  onToggleWorkspace: () => void;
  user: User | null;
  onDeleted: () => void;
};

function panelToggle(active: boolean) {
  return `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
    active
      ? 'bg-brand text-white border-brand-light shadow-sm'
      : 'bg-panel/80 text-muted border-border hover:text-white hover:border-brand/40'
  }`;
}

export function StudioTopBar({
  projectId,
  projectName,
  status,
  viewMode,
  onViewModeChange,
  showChat,
  onToggleChat,
  showWorkspace,
  onToggleWorkspace,
  user,
  onDeleted,
}: StudioTopBarProps) {
  return (
    <header className="h-11 border-b border-border bg-[#0a1628] flex items-center gap-2 px-2 sm:px-3 shrink-0 z-20">
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-muted hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-panel/60"
        title="Back to projects"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Projects</span>
      </Link>

      <div className="w-px h-5 bg-border hidden sm:block" />

      <BrandLogo href="/dashboard" size={26} showName={false} className="shrink-0" />
      <div className="min-w-0 flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-brand-muted font-medium">Studio</span>
        <span className="text-sm text-white font-medium truncate max-w-[120px] sm:max-w-[200px]">
          {projectName}
        </span>
      </div>

      {status && (
        <span className="hidden lg:inline text-[11px] text-brand-muted truncate max-w-[280px] ml-1">
          {status}
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-panel/50 border border-border">
        <button
          type="button"
          onClick={() => onViewModeChange('mesh')}
          className={panelToggle(viewMode === 'mesh')}
          title="Quick mesh preview"
        >
          <Box className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Mesh</span>
        </button>
        <button
          type="button"
          data-viewer-tab=""
          onClick={() => onViewModeChange('viewer')}
          className={panelToggle(viewMode === 'viewer')}
          title="Full CAD workbench"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CAD Workbench</span>
        </button>
      </div>

      <div className="w-px h-5 bg-border mx-1 hidden md:block" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleWorkspace}
          className={panelToggle(showWorkspace)}
          title="Project files & parts catalog"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Workspace</span>
        </button>
        <button
          type="button"
          onClick={onToggleChat}
          className={panelToggle(showChat)}
          title="Design assistant"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Assistant</span>
        </button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {user && (
        <span className="hidden xl:inline text-[11px] text-muted whitespace-nowrap">
          {formatCredits(user)} credits
        </span>
      )}

      <DeleteProjectButton
        projectId={projectId}
        projectName={projectName}
        variant="header"
        onDeleted={onDeleted}
      />

      <Link
        href="/settings"
        className="p-2 rounded-lg text-muted hover:text-white hover:bg-panel/60 border border-transparent hover:border-border"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </Link>
    </header>
  );
}
