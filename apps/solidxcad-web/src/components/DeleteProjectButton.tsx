'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
  onDeleted?: () => void;
  className?: string;
  variant?: 'card' | 'header' | 'icon';
};

export function DeleteProjectButton({
  projectId,
  projectName,
  onDeleted,
  className = '',
  variant = 'card',
}: DeleteProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteProject(projectId);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const triggerClass = variant === 'icon'
    ? 'p-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-400/40 hover:bg-red-500/10 transition-colors'
    : variant === 'header'
      ? 'text-xs text-muted hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-red-400/40'
      : 'text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1';

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirmText('');
          setError('');
          setOpen(true);
        }}
        className={`${triggerClass} ${className}`}
      >
        <Trash2 className={variant === 'icon' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {variant !== 'icon' && 'Delete'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-md p-5 space-y-4" role="dialog" aria-modal="true">
            <div>
              <h2 className="text-lg font-semibold text-white">Permanently delete project?</h2>
              <p className="text-sm text-muted mt-2">
                This removes <span className="text-white">{projectName}</span>, all CAD/URDF files,
                chat history, and project files. This cannot be undone.
              </p>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">
                Type <span className="text-white font-mono">DELETE</span> to confirm
              </label>
              <input
                className="input w-full font-mono"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn-ghost px-4 py-2"
                disabled={deleting}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-40"
                disabled={!canDelete || deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Permanently delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
