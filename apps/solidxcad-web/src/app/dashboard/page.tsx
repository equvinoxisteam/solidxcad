'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { ProjectSortMenu, type ProjectSortKey } from '@/components/ProjectSortMenu';
import { api, getToken, projectId, type Project } from '@/lib/api';

type SortKey = ProjectSortKey;

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function sortProjects(list: Project[], sortKey: SortKey): Project[] {
  const copy = [...list];
  copy.sort((a, b) => {
    switch (sortKey) {
      case 'updated-asc':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'created-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'created-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'name-asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'name-desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'updated-desc':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
  return copy;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated-desc');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    api.me()
      .then(({ user }) => {
        if (!user.onboardingCompleted) {
          router.push('/onboarding');
          return;
        }
        load();
      })
      .catch(() => router.push('/login'));
  }, [router]);

  async function load() {
    try {
      setError('');
      const { projects: list } = await api.getProjects();
      setProjects(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load projects';
      if (msg.includes('log in') || msg.includes('Authentication')) {
        router.push('/login');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { project } = await api.createProject({ name: name.trim() });
      const id = projectId(project);
      if (!id) throw new Error('Project created but no id returned');
      router.push(`/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? projects.filter((p) => p.name.toLowerCase().includes(q))
      : projects;
    return sortProjects(filtered, sortKey);
  }, [projects, search, sortKey]);

  const projectCountLabel = loading
    ? 'Loading projects…'
    : `${projects.length} project${projects.length === 1 ? '' : 's'}`;

  return (
    <div className="dashboard-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg opacity-60" aria-hidden />
      <div className="auth-grid opacity-40" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {error && (
            <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4 sm:gap-5 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Projects</h1>
                <p className="text-sm text-gray-500 mt-1">{projectCountLabel}</p>
              </div>

              <form onSubmit={createProject} className="flex flex-col sm:flex-row gap-2 w-full lg:max-w-lg">
                <input
                  className="auth-input flex-1 min-w-0 h-10 text-sm"
                  placeholder="New project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="New project name"
                />
                <button
                  type="submit"
                  className="auth-btn-primary flex items-center justify-center gap-2 px-4 h-10 text-sm shrink-0"
                  disabled={creating || !name.trim()}
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  New project
                </button>
              </form>
            </div>

            {!loading && projects.length > 0 && (
              <div className="dashboard-toolbar">
                <div className="dashboard-search-wrap">
                  <Search className="dashboard-search-icon" aria-hidden />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search projects"
                    className="dashboard-search-input"
                    aria-label="Search projects"
                  />
                </div>
                <ProjectSortMenu value={sortKey} onChange={setSortKey} />
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : !projects.length ? (
            <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/80 p-10 sm:p-12 text-center">
              <div className="dashboard-empty-icon">
                <Plus className="w-5 h-5 text-brand" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">No projects yet</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
                Create your first project above, then describe parts in chat. SolidX CAD will generate
                your STEP, STL, and manufacturing files.
              </p>
            </div>
          ) : !visibleProjects.length ? (
            <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/80 p-10 text-center">
              <p className="text-sm text-gray-400">No projects match your search.</p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-sm text-brand-muted hover:text-white mt-3 underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 overflow-hidden">
              <div className="hidden lg:grid grid-cols-[minmax(0,1.4fr)_140px_140px_88px] gap-4 px-5 py-3 border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <span>Project</span>
                <span>Last updated</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>

              <ul className="divide-y divide-white/5">
                {visibleProjects.map((p) => (
                  <li key={p._id}>
                    <div className="group flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
                      <Link
                        href={`/projects/${p._id}`}
                        className="dashboard-project-link flex min-w-0 flex-1 items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_140px_140px] lg:gap-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="dashboard-project-icon">
                            <FolderOpen className="w-4 h-4 text-brand" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="dashboard-project-name text-sm sm:text-base truncate">
                              {p.name}
                            </p>
                            <p className="text-xs text-gray-400 flex items-center gap-1.5 lg:hidden mt-0.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Updated {formatDate(p.updatedAt)}</span>
                            </p>
                          </div>
                        </div>

                        <p className="hidden lg:block text-sm text-gray-300 truncate tabular-nums">
                          {formatDate(p.updatedAt)}
                        </p>
                        <p className="hidden lg:block text-sm text-gray-400 truncate tabular-nums">
                          {formatDate(p.createdAt)}
                        </p>
                      </Link>

                      <div className="flex items-center gap-1 shrink-0">
                        <DeleteProjectButton
                          projectId={p._id}
                          projectName={p.name}
                          onDeleted={load}
                          variant="icon"
                          className="!p-2 !rounded-lg opacity-70 group-hover:opacity-100"
                        />
                        <Link
                          href={`/projects/${p._id}`}
                          className="p-2 rounded-lg text-gray-500 hover:text-brand-muted hover:bg-brand/10 transition-colors"
                          title="Open project"
                          aria-label={`Open ${p.name}`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
