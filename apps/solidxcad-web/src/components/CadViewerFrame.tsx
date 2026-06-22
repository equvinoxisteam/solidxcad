'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { api } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

type CadViewerFrameProps = {
  projectId: string;
  fileRef?: string;
  reloadToken?: number;
};

export function CadViewerFrame({ projectId, fileRef, reloadToken = 0 }: CadViewerFrameProps) {
  const [viewerLink, setViewerLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'solidxcad-regenerate-step') return;
      const stepFile = String(data.stepFile || '').trim();
      const parameters = data.parameters && typeof data.parameters === 'object' ? data.parameters : {};
      if (!stepFile) return;
      try {
        await api.regenerateStepParameters(projectId, { step: stepFile, parameters });
        setReloadKey((k) => k + 1);
      } catch {
        // parent stays on current model; viewer can retry
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [projectId]);

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
        setReloadKey((k) => k + 1);
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
  }, [projectId, fileRef, reloadToken]);

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
        <p className="text-sm text-gray-700 font-medium">CAD Workbench is syncing</p>
        <p className="text-xs text-muted max-w-md">
          Your files are loading — refresh in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <iframe
        key={`${viewerLink}:${reloadKey}`}
        title={`${BRAND_NAME} Workbench`}
        src={viewerLink}
        className="w-full h-full border-0 bg-white"
        allow="fullscreen"
      />
    </div>
  );
}
