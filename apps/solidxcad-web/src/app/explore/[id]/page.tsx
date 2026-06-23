'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileBox, Loader2, Shuffle } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { ProjectModelPreview } from '@/components/ProjectModelPreview';
import { RemixModal } from '@/components/RemixModal';
import {
  api,
  getToken,
  projectId,
  type PublicProject,
  type PublicProjectFile,
} from '@/lib/api';
import { sanitizeUserError } from '@/lib/userFacingErrors';

function formatPublished(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ExploreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [files, setFiles] = useState<PublicProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remixOpen, setRemixOpen] = useState(false);
  const [remixLoading, setRemixLoading] = useState(false);
  const [remixError, setRemixError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ project: p }, { files: f }] = await Promise.all([
        api.getPublicProject(id),
        api.getPublicProjectFiles(id),
      ]);
      setProject(p);
      setFiles(f);
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'load'));
      setProject(null);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function openRemix() {
    if (!getToken()) {
      router.push(`/login?next=${encodeURIComponent(`/explore/${id}`)}`);
      return;
    }
    setRemixError('');
    setRemixOpen(true);
  }

  async function handleRemix(name: string) {
    setRemixLoading(true);
    setRemixError('');
    try {
      const { project: created } = await api.remixPublicProject(id, name);
      setRemixOpen(false);
      router.push(`/projects/${projectId(created)}`);
    } catch (err) {
      setRemixError(sanitizeUserError(err instanceof Error ? err.message : '', 'save'));
    } finally {
      setRemixLoading(false);
    }
  }

  return (
    <div className="dashboard-scene min-h-screen relative overflow-hidden">
      <div className="auth-bg opacity-50" aria-hidden />
      <div className="auth-grid opacity-30" aria-hidden />

      <div className="relative z-10 min-h-screen">
        <DashboardShell>
          <div className="dashboard-page-body explore-detail-page">
            <Link href="/explore" className="explore-back-link">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to Explore
            </Link>

            {loading ? (
              <div className="flex justify-center items-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
              </div>
            ) : error || !project ? (
              <div className="dashboard-empty-card mt-6">
                <p className="text-sm text-gray-700">{error || 'Public project not found.'}</p>
                <Link href="/explore" className="text-sm text-brand hover:text-brand-hover mt-3 inline-block font-medium">
                  Browse Explore
                </Link>
              </div>
            ) : (
              <div className="explore-detail-layout">
                <div className="explore-detail-preview-wrap">
                  <ProjectModelPreview
                    project={project}
                    files={files}
                    publicMode
                    className="explore-detail-preview"
                  />
                </div>

                <div className="explore-detail-panel">
                  <p className="explore-detail-eyebrow">Public design</p>
                  <h1 className="explore-detail-title">{project.name}</h1>
                  {project.description && (
                    <p className="explore-detail-desc">{project.description}</p>
                  )}

                  <dl className="explore-detail-stats">
                    <div>
                      <dt>Designer</dt>
                      <dd>{project.authorName || 'Designer'}</dd>
                    </div>
                    {project.publishedAt && (
                      <div>
                        <dt>Published</dt>
                        <dd>{formatPublished(project.publishedAt)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Remixes</dt>
                      <dd>{project.remixCount || 0}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={openRemix}
                    className="auth-btn-primary w-full flex items-center justify-center gap-2 h-11 text-sm"
                  >
                    <Shuffle className="w-4 h-4" aria-hidden />
                    Remix into my workspace
                  </button>
                  <p className="explore-detail-remix-note">
                    Creates a copy you can edit in your own project — the original stays public.
                  </p>

                  {files.length > 0 && (
                    <div className="explore-detail-files">
                      <h2 className="explore-detail-files-title">
                        <FileBox className="w-4 h-4" aria-hidden />
                        Included files
                      </h2>
                      <ul className="explore-detail-file-list">
                        {files.map((file) => (
                          <li key={file._id}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DashboardShell>
      </div>

      <RemixModal
        open={remixOpen}
        sourceName={project?.name || 'Project'}
        loading={remixLoading}
        error={remixError}
        onClose={() => setRemixOpen(false)}
        onSubmit={handleRemix}
      />
    </div>
  );
}
