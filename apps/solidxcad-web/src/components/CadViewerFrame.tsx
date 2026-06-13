'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs">Loading CAD Workbench…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
        <BrandLogo size={56} showName={false} />
        <p className="text-sm text-white/80 font-medium">CAD Workbench is syncing</p>
        <p className="text-xs text-muted max-w-md">
          Your files are loading — refresh in a moment or use Mesh view meanwhile.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <iframe
        title="SolidX CAD Workbench"
        src={viewerLink}
        className="w-full h-full border-0 bg-base"
        allow="fullscreen"
      />
    </div>
  );
}
