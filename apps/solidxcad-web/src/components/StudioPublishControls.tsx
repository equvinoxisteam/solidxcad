'use client';

import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api, type Project } from '@/lib/api';
import { sanitizeUserError } from '@/lib/userFacingErrors';

type StudioPublishControlsProps = {
  projectId: string;
  project: Project | null;
  onProjectChange: (project: Project) => void;
  onStatus: (msg: string) => void;
};

export function StudioPublishControls({
  projectId,
  project,
  onProjectChange,
  onStatus,
}: StudioPublishControlsProps) {
  const [loading, setLoading] = useState(false);
  const isPublic = Boolean(project?.isPublic);

  async function publish() {
    setLoading(true);
    try {
      const { project: next } = await api.publishProject(projectId);
      onProjectChange(next);
      onStatus('Published — visible in Explore');
    } catch (err) {
      onStatus(sanitizeUserError(err instanceof Error ? err.message : '', 'save'));
    } finally {
      setLoading(false);
    }
  }

  async function unpublish() {
    setLoading(true);
    try {
      const { project: next } = await api.unpublishProject(projectId);
      onProjectChange(next);
      onStatus('Unpublished — only you can see this project');
    } catch (err) {
      onStatus(sanitizeUserError(err instanceof Error ? err.message : '', 'save'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="studio-publish-controls">
      {isPublic ? (
        <>
          <Link
            href={`/explore/${projectId}`}
            target="_blank"
            rel="noreferrer"
            className="studio-publish-link hidden md:inline-flex"
            title="View in Explore"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden />
            Explore
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={unpublish}
            className="studio-publish-btn studio-publish-btn-muted"
            title="Remove from public Explore gallery"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Unpublish'}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={publish}
          className="studio-publish-btn studio-publish-btn-primary"
          title="Share in public Explore gallery"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Globe className="w-3.5 h-3.5" aria-hidden />
              <span className="hidden sm:inline">Publish</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
