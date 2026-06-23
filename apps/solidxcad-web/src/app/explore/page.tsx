'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Globe, Loader2, Search, Shuffle } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { ProjectModelPreview } from '@/components/ProjectModelPreview';
import { api, getToken, type PublicProject } from '@/lib/api';
import { sanitizeUserError } from '@/lib/userFacingErrors';

type SortKey = 'recent' | 'popular' | 'name';

function formatPublished(iso?: string | null) {
  if (!iso) return 'Recently published';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExplorePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { projects: list } = await api.getPublicProjects({
        q: debouncedSearch || undefined,
        sort,
      });
      setProjects(list);
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'load'));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const countLabel = useMemo(() => {
    if (loading) return 'Loading public designs…';
    return `${projects.length} public design${projects.length === 1 ? '' : 's'}`;
  }, [loading, projects.length]);

  return (
    <div className="dashboard-scene min-h-screen relative overflow-hidden">
      <div className="auth-bg opacity-50" aria-hidden />
      <div className="auth-grid opacity-30" aria-hidden />

      <div className="relative z-10 h-screen">
        <DashboardShell>
          <div className="dashboard-page-body">
            <header className="dashboard-page-header">
              <div>
                <p className="dashboard-page-eyebrow">Community</p>
                <h1 className="dashboard-page-title flex items-center gap-2">
                  <Compass className="w-7 h-7 text-brand" aria-hidden />
                  Explore
                </h1>
                <p className="dashboard-page-subtitle">{countLabel}</p>
              </div>
              {!getToken() && (
                <Link href="/login" className="auth-btn-primary flex items-center justify-center px-4 h-10 text-sm shrink-0">
                  Sign in to remix
                </Link>
              )}
            </header>

            {error && (
              <div className="dashboard-alert dashboard-alert-error">{error}</div>
            )}

            <div className="explore-toolbar">
              <div className="explore-search-wrap">
                <Search className="explore-search-icon" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search designs, authors, keywords…"
                  className="explore-search-input"
                  aria-label="Search public designs"
                />
              </div>
              <div className="explore-sort-pills" role="group" aria-label="Sort public designs">
                {([
                  ['recent', 'Newest'],
                  ['popular', 'Popular'],
                  ['name', 'A–Z'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`explore-sort-pill${sort === key ? ' is-active' : ''}`}
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="dashboard-projects-scroll flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
              </div>
            ) : !projects.length ? (
              <div className="dashboard-projects-scroll">
                <div className="dashboard-empty-card">
                  <div className="dashboard-empty-icon">
                    <Globe className="w-5 h-5 text-brand" aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">No public designs yet</h2>
                  <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">
                    {debouncedSearch
                      ? 'Try another search term or clear the filter.'
                      : 'Publish a project from the studio Public tab to share it here.'}
                  </p>
                  {debouncedSearch && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-sm text-brand hover:text-brand-hover mt-3 font-medium"
                    >
                      Clear search
                    </button>
                  )}
                  {getToken() && (
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="auth-btn-primary inline-flex items-center gap-2 px-5 mt-4"
                    >
                      Go to projects
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="dashboard-projects-scroll">
                <div className="explore-grid">
                  {projects.map((project) => (
                    <article key={project._id} className="explore-card">
                      <Link href={`/explore/${project._id}`} className="explore-card-link">
                        <div className="explore-card-preview">
                          <ProjectModelPreview
                            project={project}
                            publicMode
                            className="explore-card-preview-canvas"
                          />
                        </div>
                        <div className="explore-card-body">
                          <h2 className="explore-card-title">{project.name}</h2>
                          {project.description && (
                            <p className="explore-card-desc">{project.description}</p>
                          )}
                          <div className="explore-card-meta">
                            <span>{project.authorName || 'Designer'}</span>
                            <span aria-hidden>·</span>
                            <span>{formatPublished(project.publishedAt)}</span>
                            {(project.remixCount || 0) > 0 && (
                              <>
                                <span aria-hidden>·</span>
                                <span className="explore-card-remix">
                                  <Shuffle className="w-3 h-3" aria-hidden />
                                  {project.remixCount} remix{project.remixCount === 1 ? '' : 'es'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DashboardShell>
      </div>
    </div>
  );
}
