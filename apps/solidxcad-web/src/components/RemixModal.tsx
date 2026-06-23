'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

type RemixModalProps = {
  open: boolean;
  sourceName: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function RemixModal({
  open,
  sourceName,
  loading = false,
  error = '',
  onClose,
  onSubmit,
}: RemixModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(`${sourceName} remix`);
  }, [open, sourceName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white border border-border shadow-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 m-0">Remix project</h2>
            <p className="text-sm text-muted mt-1 m-0">
              Copy <span className="font-medium text-gray-800">{sourceName}</span> into your workspace.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-muted hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block text-xs font-medium text-gray-700 mb-1.5" htmlFor="remix-name">
          New project name
        </label>
        <input
          id="remix-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${sourceName} remix`}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-brand"
          autoFocus
        />

        {error && (
          <p className="text-sm text-red-600 mt-2 m-0">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-gray-800 hover:bg-elevated"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !name.trim()}
            onClick={() => onSubmit(name.trim())}
            className="flex-1 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-medium py-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create remix'}
          </button>
        </div>
      </div>
    </div>
  );
}
