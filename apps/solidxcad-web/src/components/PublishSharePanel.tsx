'use client';

import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { api, type Project } from '@/lib/api';
import { sanitizeUserError } from '@/lib/userFacingErrors';

type PublishSharePanelProps = {
  projectId: string;
  project: Project | null;
  onProjectChange: (project: Project) => void;
  onStatus: (msg: string) => void;
};

export function PublishSharePanel({
  projectId,
  project,
  onProjectChange,
  onStatus,
}: PublishSharePanelProps) {
  const [loading, setLoading] = useState(false);

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

  const isPublic = Boolean(project?.isPublic);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-3 gap-3">
      <div className="rounded-xl border border-border bg-elevated p-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-brand" />
          <p className="text-sm font-semibold text-gray-900 m-0">Public gallery</p>
        </div>
        <p className="text-xs text-muted leading-relaxed m-0 mb-3">
          {isPublic
            ? 'Anyone can browse this design in Explore and remix it into their own workspace.'
            : 'Publish to share your model in Explore. Others can view and remix your design files.'}
        </p>

        {isPublic ? (
          <div className="space-y-2">
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2 m-0">
              Live in Explore
              {project?.remixCount ? ` · ${project.remixCount} remix${project.remixCount === 1 ? '' : 'es'}` : ''}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={unpublish}
              className="w-full rounded-lg border border-border bg-white hover:bg-elevated text-sm font-medium py-2 text-gray-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Unpublish'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={publish}
            className="w-full rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-medium py-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Publish to Explore'}
          </button>
        )}
      </div>

      {isPublic && (
        <a
          href={`/explore/${projectId}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand hover:text-brand-hover font-medium"
        >
          View public page →
        </a>
      )}
    </div>
  );
}
