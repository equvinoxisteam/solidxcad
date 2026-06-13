'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { api } from '@/lib/api';

type CadViewerFrameProps = {
  projectId: string;
  fileRef?: string;
};

export function CadViewerFrame({ projectId, fileRef }: CadViewerFrameProps) {
  const [viewerLink, setViewerLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const openedForLink = useRef('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    async function loadSession(attempt = 0) {
      try {
        await api.syncViewerWorkspace(projectId).catch(() => null);
        const session = await api.getViewerSession(projectId, fileRef);
        if (cancelled) return;
        setViewerLink(session.viewerLink);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (attempt < 8) {
          await new Promise((r) => setTimeout(r, 2000));
          return loadSession(attempt + 1);
        }
        setError('workbench_unavailable');
        setLoading(false);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [projectId, fileRef]);

  useEffect(() => {
    if (!viewerLink || openedForLink.current === viewerLink) return;
    openedForLink.current = viewerLink;
    window.open(viewerLink, '_blank', 'noopener,noreferrer');
  }, [viewerLink]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs">Opening CAD Workbench…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
        <BrandLogo size={56} showName={false} />
        <p className="text-sm text-white/80 font-medium">CAD Workbench is syncing</p>
        <p className="text-xs text-muted max-w-md">
          Your files are loading — try again in a moment or use Mesh view meanwhile.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <BrandLogo size={72} showName={false} />
      <div>
        <p className="text-sm text-white/90 font-medium">CAD Workbench opened in a new tab</p>
        <p className="text-xs text-muted mt-1 max-w-sm">
          Use the full workbench for STEP assemblies, URDF motion, and project files.
        </p>
      </div>
      <a
        href={viewerLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-xs font-medium border border-brand/50 text-brand-muted px-3 py-2 rounded-lg hover:bg-brand/20 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Reopen Workbench
      </a>
    </div>
  );
}

export async function openProjectViewerInNewTab(projectId: string, fileRef?: string) {
  await api.syncViewerWorkspace(projectId).catch(() => null);
  const session = await api.getViewerSession(projectId, fileRef);
  window.open(session.viewerLink, '_blank', 'noopener,noreferrer');
}
