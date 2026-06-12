'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  FolderOpen,
  FolderPlus,
  Loader2,
  Plus,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { api, getToken, projectId, type Project } from '@/lib/api';

function formatUpdated(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

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

  return (
    <div className="dashboard-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg opacity-60" aria-hidden />
      <div className="auth-grid opacity-40" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
          {error && (
            <div className="mb-6 text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl p-3">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Projects</h1>
              <p className="text-gray-400 text-sm mt-1">Your CAD workspaces</p>
            </div>
            <form onSubmit={createProject} className="flex gap-2 w-full sm:w-auto">
              <input
                className="auth-input flex-1 sm:w-56"
                placeholder="New project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                type="submit"
                className="auth-btn-primary flex items-center gap-2 px-5 shrink-0"
                disabled={creating || !name.trim()}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderPlus className="w-4 h-4" />
                )}
                New
              </button>
            </form>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-9 h-9 animate-spin text-brand" />
            </div>
          ) : !projects.length ? (
            <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/80 p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/25 flex items-center justify-center mx-auto mb-4">
                <Plus className="w-7 h-7 text-brand" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">No projects yet</h2>
              <p className="text-gray-400 text-sm max-w-sm mx-auto">
                Create a project above, then describe parts in chat — SolidX CAD builds your 3D files.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <article
                  key={p._id}
                  className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 p-5 flex flex-col gap-4 hover:border-brand/35 transition-colors group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-5 h-5 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white truncate text-base">{p.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        Updated {formatUpdated(p.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <Link
                      href={`/projects/${p._id}`}
                      className="flex-1 auth-btn-primary flex items-center justify-center gap-2 py-2 text-sm"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Open studio
                    </Link>
                    <DeleteProjectButton
                      projectId={p._id}
                      projectName={p.name}
                      onDeleted={load}
                      variant="icon"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
