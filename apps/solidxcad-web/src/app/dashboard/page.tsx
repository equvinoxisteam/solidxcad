'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
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
import { api, getToken, projectId, type Project } from '@/lib/api';

type SortKey = 'updated-desc' | 'updated-asc' | 'created-desc' | 'created-asc' | 'name-asc' | 'name-desc';

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

  return (
    <div className="dashboard-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg opacity-60" aria-hidden />
      <div className="auth-grid opacity-40" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          {error && (
            <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Projects</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  {loading ? 'Loading…' : `${projects.length} workspace${projects.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <form onSubmit={createProject} className="flex gap-2 w-full sm:w-auto sm:max-w-xs">
                <input
                  className="auth-input flex-1 h-9 text-sm py-1.5"
                  placeholder="New project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="submit"
                  className="auth-btn-primary flex items-center gap-1.5 px-3 h-9 text-sm shrink-0"
                  disabled={creating || !name.trim()}
                >
                  {creating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderPlus className="w-3.5 h-3.5" />
                  )}
                  New
                </button>
              </form>
            </div>

            {!loading && projects.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="auth-input w-full h-9 pl-9 pr-3 text-sm py-1.5"
                    aria-label="Search projects"
                  />
                </div>
                <div className="relative sm:w-48 shrink-0">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="auth-input w-full h-9 pl-9 pr-8 text-sm py-1.5 appearance-none cursor-pointer"
                    aria-label="Sort projects"
                  >
                    <option value="updated-desc">Updated · newest</option>
                    <option value="updated-asc">Updated · oldest</option>
                    <option value="created-desc">Created · newest</option>
                    <option value="created-asc">Created · oldest</option>
                    <option value="name-asc">Name · A–Z</option>
                    <option value="name-desc">Name · Z–A</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-brand" />
            </div>
          ) : !projects.length ? (
            <div className="auth-card rounded-xl border border-white/10 bg-[#0a1628]/80 p-12 text-center">
              <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center mx-auto mb-3">
                <Plus className="w-5 h-5 text-brand" />
              </div>
              <h2 className="text-base font-semibold text-white mb-1.5">No projects yet</h2>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Create a project above, then describe parts in chat — SolidX CAD builds your 3D files.
              </p>
            </div>
          ) : !visibleProjects.length ? (
            <div className="auth-card rounded-xl border border-white/10 bg-[#0a1628]/80 p-10 text-center">
              <p className="text-sm text-gray-400">No projects match &ldquo;{search.trim()}&rdquo;</p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs text-brand-muted hover:text-white mt-2 underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="auth-card rounded-xl border border-white/10 bg-[#0a1628]/85 overflow-hidden">
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_128px_128px_72px] gap-3 px-4 py-2.5 border-b border-white/5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                <span>Project</span>
                <span>Updated</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>

              <ul className="divide-y divide-white/5">
                {visibleProjects.map((p) => (
                  <li key={p._id}>
                    <div className="group flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
                      <Link
                        href={`/projects/${p._id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 md:grid md:grid-cols-[minmax(0,1fr)_128px_128px] md:gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand/12 border border-brand/20 flex items-center justify-center shrink-0">
                            <FolderOpen className="w-3.5 h-3.5 text-brand" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate group-hover:text-brand-muted transition-colors">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 md:hidden">
                              <Calendar className="w-3 h-3 shrink-0" />
                              {formatDate(p.updatedAt)}
                            </p>
                          </div>
                        </div>

                        <p className="hidden md:block text-xs text-gray-500 truncate">
                          {formatDate(p.updatedAt)}
                        </p>
                        <p className="hidden md:block text-xs text-gray-600 truncate">
                          {formatDate(p.createdAt)}
                        </p>
                      </Link>

                      <div className="flex items-center gap-1 shrink-0 ml-auto md:ml-0">
                        <DeleteProjectButton
                          projectId={p._id}
                          projectName={p.name}
                          onDeleted={load}
                          variant="icon"
                          className="!p-1.5 !rounded-lg opacity-60 group-hover:opacity-100"
                        />
                        <Link
                          href={`/projects/${p._id}`}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-brand-muted hover:bg-brand/10 transition-colors"
                          title="Open studio"
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
