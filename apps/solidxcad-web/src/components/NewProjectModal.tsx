'use client';

import { useEffect, useRef } from 'react';
import { FolderPlus, Loader2, X } from 'lucide-react';

type NewProjectModalProps = {
  open: boolean;
  name: string;
  creating: boolean;
  error?: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function NewProjectModal({
  open,
  name,
  creating,
  error,
  onNameChange,
  onClose,
  onSubmit,
}: NewProjectModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !creating) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, creating, onClose]);

  if (!open) return null;

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={creating ? undefined : onClose}>
      <div
        className="dashboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dashboard-modal-header">
          <div className="flex items-center gap-3">
            <div className="dashboard-modal-icon">
              <FolderPlus className="w-5 h-5 text-brand" aria-hidden />
            </div>
            <div>
              <h2 id="new-project-title" className="dashboard-modal-title">
                New project
              </h2>
              <p className="dashboard-modal-subtitle">Give your workspace a name to get started.</p>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-modal-close"
            onClick={onClose}
            disabled={creating}
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={onSubmit} className="dashboard-modal-body">
          {error && (
            <div className="dashboard-modal-error">{error}</div>
          )}

          <label className="dashboard-field-label" htmlFor="new-project-name">
            Project name
          </label>
          <input
            ref={inputRef}
            id="new-project-name"
            className="auth-input"
            placeholder="e.g. Bracket assembly, Robot arm…"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={creating}
            autoComplete="off"
          />

          <div className="dashboard-modal-actions">
            <button
              type="button"
              className="dashboard-btn-secondary"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="auth-btn-primary flex items-center justify-center gap-2 px-5"
              disabled={creating || !name.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" aria-hidden />
                  Create project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
