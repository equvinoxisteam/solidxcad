'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Box,
  FolderTree,
  Monitor,
  PanelRightClose,
  Settings,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
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

function viewToggle(active: boolean) {
  return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
    active
      ? 'bg-brand text-white border-brand shadow-sm'
      : 'bg-white text-muted border-border hover:text-gray-900 hover:border-brand/40'
  }`;
}

function iconToggle(active: boolean) {
  return `p-2 rounded-lg border transition-colors ${
    active
      ? 'bg-brand text-white border-brand'
      : 'bg-white text-muted border-border hover:text-gray-900 hover:border-brand/40'
  }`;
}

export function StudioTopBar({
  projectName,
  status,
  viewMode,
  onViewModeChange,
  showChat,
  onToggleChat,
  showWorkspace,
  onToggleWorkspace,
}: StudioTopBarProps) {
  return (
    <header className="h-11 border-b border-border bg-white flex items-center gap-2 px-2 sm:px-3 shrink-0 z-20">
      <Link
        href="/dashboard"
        className="p-2 rounded-lg text-muted hover:text-gray-900 hover:bg-elevated border border-transparent hover:border-border"
        title="Back to projects"
        aria-label="Back to projects"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      <BrandLogo href="/dashboard" size={28} className="shrink-0" />

      <span className="text-sm text-gray-900 font-semibold truncate max-w-[140px] sm:max-w-[220px]">
        {projectName}
      </span>

      {status && (
        <span className="hidden xl:inline text-[11px] text-brand-muted truncate max-w-[240px]">
          {status}
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-elevated border border-border">
        <button
          type="button"
          onClick={() => onViewModeChange('mesh')}
          className={viewToggle(viewMode === 'mesh')}
          title="Mesh preview"
        >
          <Box className="w-3.5 h-3.5" />
          <span>Mesh</span>
        </button>
        <button
          type="button"
          data-viewer-tab=""
          onClick={() => onViewModeChange('viewer')}
          className={viewToggle(viewMode === 'viewer')}
          title="CAD Workbench"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CAD Workbench</span>
          <span className="sm:hidden">CAD</span>
        </button>
      </div>

      <div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleWorkspace}
          className={iconToggle(showWorkspace)}
          title="Workspace files"
          aria-label="Workspace"
          aria-pressed={showWorkspace}
        >
          <FolderTree className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleChat}
          className={iconToggle(showChat)}
          title={showChat ? 'Hide agent' : 'Show agent'}
          aria-label={showChat ? 'Hide agent' : 'Show agent'}
          aria-pressed={showChat}
        >
          {showChat ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </button>
      </div>

      <Link
        href="/settings"
        className="p-2 rounded-lg text-muted hover:text-gray-900 hover:bg-elevated border border-transparent hover:border-border"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
      </Link>
    </header>
  );
}
