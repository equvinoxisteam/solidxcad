'use client';

import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { StudioPublishControls } from '@/components/StudioPublishControls';
import type { Project } from '@/lib/api';

type StudioTopBarProps = {
  projectId: string;
  project: Project | null;
  projectName: string;
  status?: string;
  onProjectChange: (project: Project) => void;
  onStatus: (msg: string) => void;
};

export function StudioTopBar({
  projectId,
  project,
  projectName,
  status,
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

      <Link
        href="/settings"
        className="studio-topbar-icon-btn"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
      </Link>
    </header>
  );
}
