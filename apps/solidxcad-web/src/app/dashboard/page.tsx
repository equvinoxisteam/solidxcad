'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BRAND_NAME } from '@/lib/brand';
import {
  Calendar,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { NewProjectModal } from '@/components/NewProjectModal';
import { RenameProjectModal } from '@/components/RenameProjectModal';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated-desc');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

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

  function openModal() {
    setName('');
    setModalError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
    setName('');
    setModalError('');
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setModalError('');
    try {
      const { project } = await api.createProject({ name: name.trim() });
      const id = projectId(project);
      if (!id) throw new Error('Project created but no id returned');
      setModalOpen(false);
      setName('');
      router.push(`/projects/${id}`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  function openRename(project: Project) {
    setRenameTarget(project);
    setRenameName(project.name || '');
    setRenameError('');
    setRenameOpen(true);
  }

  function closeRename() {
    if (renaming) return;
    setRenameOpen(false);
    setRenameTarget(null);
    setRenameName('');
    setRenameError('');
  }

  async function renameProject(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget || !renameName.trim()) return;
    const trimmed = renameName.trim();
    if (trimmed === (renameTarget.name || '').trim()) {
      closeRename();
      return;
    }

    setRenaming(true);
    setRenameError('');
    try {
      const { project } = await api.updateProject(renameTarget._id, { name: trimmed });
      setProjects((list) => list.map((p) => (p._id === project._id ? project : p)));
      closeRename();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename project');
    } finally {
      setRenaming(false);
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
    <div className="dashboard-scene min-h-screen relative overflow-hidden">
      <div className="auth-bg opacity-50" aria-hidden />
      <div className="auth-grid opacity-30" aria-hidden />

      <div className="relative z-10 min-h-screen">
        <DashboardShell>
          <header className="dashboard-page-header">
            <div>
              <p className="dashboard-page-eyebrow">Workspace</p>
              <h1 className="dashboard-page-title">Projects</h1>
              <p className="dashboard-page-subtitle">{projectCountLabel}</p>
            </div>
            <button
              type="button"
              className="auth-btn-primary flex items-center justify-center gap-2 px-4 h-10 text-sm shrink-0"
              onClick={openModal}
            >
              <FolderPlus className="w-4 h-4" aria-hidden />
              New project
            </button>
          </header>

          {error && (
            <div className="dashboard-alert dashboard-alert-error">{error}</div>
          )}

          {!loading && projects.length > 0 && (
            <div className="dashboard-toolbar mb-6">
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

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : !projects.length ? (
            <div className="dashboard-empty-card">
              <div className="dashboard-empty-icon">
                <Plus className="w-5 h-5 text-brand" aria-hidden />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h2>
              <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed mb-5">
                Create your first project, then describe parts in chat. {BRAND_NAME} will generate
                your STEP, STL, and manufacturing files.
              </p>
              <button
                type="button"
                className="auth-btn-primary inline-flex items-center gap-2 px-5"
                onClick={openModal}
              >
                <FolderPlus className="w-4 h-4" aria-hidden />
                Create first project
              </button>
            </div>
          ) : !visibleProjects.length ? (
            <div className="dashboard-empty-card">
              <p className="text-sm text-gray-700">No projects match your search.</p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-sm text-brand hover:text-brand-hover mt-3 font-medium"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="dashboard-folder-grid">
              {visibleProjects.map((p) => (
                <article key={p._id} className="dashboard-folder-card group">
                  <Link href={`/projects/${p._id}`} className="dashboard-folder-card-link">
                    <div className="dashboard-folder-card-top">
                      <div className="dashboard-folder-icon">
                        <FolderOpen className="w-6 h-6 text-brand" aria-hidden />
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-gray-400 group-hover:text-brand transition-colors shrink-0"
                        aria-hidden
                      />
                    </div>
                    <p className="dashboard-folder-name">{p.name || 'Untitled project'}</p>
                    <p className="dashboard-folder-meta">
                      <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      <span>Updated {formatDate(p.updatedAt)}</span>
                    </p>
                    <p className="dashboard-folder-created">Created {formatDate(p.createdAt)}</p>
                  </Link>
                  <button
                    type="button"
                    className="dashboard-folder-rename"
                    title={`Rename ${p.name || 'project'}`}
                    aria-label={`Rename ${p.name || 'project'}`}
                    onClick={() => openRename(p)}
                  >
                    <Pencil className="w-4 h-4" aria-hidden />
                  </button>
                </article>
              ))}
            </div>
          )}
        </DashboardShell>
      </div>

      <NewProjectModal
        open={modalOpen}
        name={name}
        creating={creating}
        error={modalError}
        onNameChange={setName}
        onClose={closeModal}
        onSubmit={createProject}
      />

      <RenameProjectModal
        open={renameOpen}
        name={renameName}
        saving={renaming}
        error={renameError}
        onNameChange={setRenameName}
        onClose={closeRename}
        onSubmit={renameProject}
      />
    </div>
  );
}
