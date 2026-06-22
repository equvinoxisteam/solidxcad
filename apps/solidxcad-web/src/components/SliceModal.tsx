'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProjectFile } from '@/lib/api';
import {
  DEFAULT_SLICE_SETTINGS,
  loadSliceSettings,
  saveSliceSettings,
  type SliceSettings,
} from '@/lib/sliceSettings';
import { sanitizeUserError } from '@/lib/userFacingErrors';

type SliceModalProps = {
  open: boolean;
  projectId: string;
  file: ProjectFile;
  onClose: () => void;
  onSuccess: (gcodeName: string) => void;
  onStatus: (msg: string) => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-[11px]">
      <span className="text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand';

export function SliceModal({
  open,
  projectId,
  file,
  onClose,
  onSuccess,
  onStatus,
}: SliceModalProps) {
  const [settings, setSettings] = useState<SliceSettings>(DEFAULT_SLICE_SETTINGS);
  const [slicing, setSlicing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSettings(loadSliceSettings());
      setError('');
    }
  }, [open, file._id]);

  if (!open) return null;

  function update<K extends keyof SliceSettings>(key: K, value: SliceSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSlice() {
    setSlicing(true);
    setError('');
    saveSliceSettings(settings);
    try {
      const result = await api.sliceModel({
        projectId,
        fileId: file._id,
        settings,
      });
      if (!result.ok || !result.file) {
        throw new Error(sanitizeUserError(result.error, 'slice'));
      }
      onStatus(`G-code saved to Toolpaths: ${result.file.name}`);
      onSuccess(result.file.name);
      onClose();
    } catch (err) {
      const msg = sanitizeUserError(err instanceof Error ? err.message : '', 'slice');
      setError(msg);
      onStatus(msg);
    } finally {
      setSlicing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="card w-full max-w-lg max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slice-modal-title"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id="slice-modal-title" className="text-base font-semibold text-white">
              Slice to G-code
            </h2>
            <p className="text-[11px] text-muted mt-1 truncate" title={file.name}>
              {file.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={slicing}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">Temperature & bed</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nozzle temp (°C)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.nozzleTemp}
                  onChange={(e) => update('nozzleTemp', Number(e.target.value))}
                />
              </Field>
              <Field label="Bed temp (°C)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.bedTemp}
                  onChange={(e) => update('bedTemp', Number(e.target.value))}
                />
              </Field>
              <Field label="Bed width (mm)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.bedWidth}
                  onChange={(e) => update('bedWidth', Number(e.target.value))}
                />
              </Field>
              <Field label="Bed depth (mm)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.bedDepth}
                  onChange={(e) => update('bedDepth', Number(e.target.value))}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">Extrusion</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nozzle diameter (mm)">
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  value={settings.nozzleDiameter}
                  onChange={(e) => update('nozzleDiameter', Number(e.target.value))}
                />
              </Field>
              <Field label="Filament diameter (mm)">
                <input
                  type="number"
                  step="0.05"
                  className={inputClass}
                  value={settings.filamentDiameter}
                  onChange={(e) => update('filamentDiameter', Number(e.target.value))}
                />
              </Field>
              <Field label="Layer height (mm)">
                <input
                  type="number"
                  step="0.05"
                  className={inputClass}
                  value={settings.layerHeight}
                  onChange={(e) => update('layerHeight', Number(e.target.value))}
                />
              </Field>
              <Field label="Extrusion multiplier (%)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.extrusionMultiplier}
                  onChange={(e) => update('extrusionMultiplier', Number(e.target.value))}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">Speed & layers</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Print speed (mm/s)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.printSpeed}
                  onChange={(e) => update('printSpeed', Number(e.target.value))}
                />
              </Field>
              <Field label="Move speed (mm/s)">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.moveSpeed}
                  onChange={(e) => update('moveSpeed', Number(e.target.value))}
                />
              </Field>
              <Field label="Top layers">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.topLayers}
                  onChange={(e) => update('topLayers', Number(e.target.value))}
                />
              </Field>
              <Field label="Bottom layers">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.bottomLayers}
                  onChange={(e) => update('bottomLayers', Number(e.target.value))}
                />
              </Field>
              <Field label="Brim count">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.brimCount}
                  onChange={(e) => update('brimCount', Number(e.target.value))}
                />
              </Field>
              <Field label="Skirt count">
                <input
                  type="number"
                  className={inputClass}
                  value={settings.skirtCount}
                  onChange={(e) => update('skirtCount', Number(e.target.value))}
                />
              </Field>
            </div>
          </section>

          <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
            <input
              type="checkbox"
              checked={settings.supportEnabled}
              onChange={(e) => update('supportEnabled', e.target.checked)}
              className="rounded border-border"
            />
            Enable support material
          </label>

          {error && <p className="text-xs text-amber-700">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={slicing}
            className="px-3 py-2 text-xs rounded-lg border border-border text-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSlice}
            disabled={slicing}
            className="px-4 py-2 text-xs rounded-lg bg-brand hover:bg-brand-hover text-white flex items-center gap-2"
          >
            {slicing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Slicing…
              </>
            ) : (
              'Slice to G-code'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
