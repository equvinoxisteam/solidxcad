'use client';

import { useEffect, useRef } from 'react';
import { Loader2, Pencil, X } from 'lucide-react';

type RenameProjectModalProps = {
  open: boolean;
  name: string;
  saving: boolean;
  error?: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function RenameProjectModal({
  open,
  name,
  saving,
  error,
  onNameChange,
  onClose,
  onSubmit,
}: RenameProjectModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={saving ? undefined : onClose}>
      <div
        className="dashboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dashboard-modal-header">
          <div className="flex items-center gap-3">
            <div className="dashboard-modal-icon">
              <Pencil className="w-5 h-5 text-brand" aria-hidden />
            </div>
            <div>
              <h2 id="rename-project-title" className="dashboard-modal-title">
                Rename project
              </h2>
              <p className="dashboard-modal-subtitle">Update the folder name for this workspace.</p>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={onSubmit} className="dashboard-modal-body">
          {error && (
            <div className="dashboard-modal-error">{error}</div>
          )}

          <label className="dashboard-field-label" htmlFor="rename-project-name">
            Project name
          </label>
          <input
            ref={inputRef}
            id="rename-project-name"
            className="auth-input"
            placeholder="Project name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />

          <div className="dashboard-modal-actions">
            <button
              type="button"
              className="dashboard-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="auth-btn-primary flex items-center justify-center gap-2 px-5"
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" aria-hidden />
                  Save name
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
