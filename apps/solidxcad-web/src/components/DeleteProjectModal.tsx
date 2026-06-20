'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';

type DeleteProjectModalProps = {
  open: boolean;
  projectName: string;
  deleting: boolean;
  error?: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function DeleteProjectModal({
  open,
  projectName,
  deleting,
  error,
  confirmText,
  onConfirmTextChange,
  onClose,
  onSubmit,
}: DeleteProjectModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, deleting, onClose]);

  if (!open) return null;

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={deleting ? undefined : onClose}>
      <div
        className="dashboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dashboard-modal-header">
          <div className="flex items-center gap-3">
            <div className="dashboard-modal-icon dashboard-modal-icon-danger">
              <Trash2 className="w-5 h-5 text-red-600" aria-hidden />
            </div>
            <div>
              <h2 id="delete-project-title" className="dashboard-modal-title">
                Delete project
              </h2>
              <p className="dashboard-modal-subtitle">
                This permanently removes <strong>{projectName}</strong>, all files, and chat history.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-modal-close"
            onClick={onClose}
            disabled={deleting}
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={onSubmit} className="dashboard-modal-body">
          {error && (
            <div className="dashboard-modal-error">{error}</div>
          )}

          <label className="dashboard-field-label" htmlFor="delete-project-confirm">
            Type DELETE to confirm
          </label>
          <input
            ref={inputRef}
            id="delete-project-confirm"
            className="auth-input font-mono"
            placeholder="DELETE"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            disabled={deleting}
            autoComplete="off"
          />

          <div className="dashboard-modal-actions">
            <button
              type="button"
              className="dashboard-btn-secondary"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dashboard-btn-danger flex items-center justify-center gap-2 px-5"
              disabled={deleting || !canDelete}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" aria-hidden />
                  Delete project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
