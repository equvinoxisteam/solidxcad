'use client';

import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

type StudioTopBarProps = {
  projectName: string;
  status?: string;
};

export function StudioTopBar({ projectName, status }: StudioTopBarProps) {
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

      <span className="text-sm text-gray-900 font-semibold truncate max-w-[140px] sm:max-w-[280px]">
        {projectName}
      </span>

      {status && (
        <span className="hidden md:inline text-[11px] text-brand-muted truncate max-w-[280px]">
          {status}
        </span>
      )}

      <div className="flex-1" />

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
