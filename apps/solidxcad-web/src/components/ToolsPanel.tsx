'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileBox, Loader2, Package, Printer, Search, FolderTree } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProjectFile } from '@/lib/api';
import { ProjectFilesList } from '@/components/ProjectFilesList';
import { SliceModal } from '@/components/SliceModal';
import { isSliceableMesh } from '@/lib/sliceSettings';

type StepPart = {
  id?: string;
  name?: string;
  title?: string;
  stepUrl?: string;
};

type ToolsPanelProps = {
  projectId: string;
  files: ProjectFile[];
  highlightFile?: string;
  onRefresh: () => void;
  onStatus: (msg: string) => void;
  onHighlightFile?: (name: string) => void;
};

export function ToolsPanel({
  projectId,
  files,
  highlightFile,
  onRefresh,
  onStatus,
  onHighlightFile,
}: ToolsPanelProps) {
  const [tab, setTab] = useState<'parts' | 'files' | 'slice'>('files');
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<StepPart[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState('');
  const [selectedMeshId, setSelectedMeshId] = useState('');
  const [sliceModalOpen, setSliceModalOpen] = useState(false);

  const sliceableFiles = useMemo(() => files.filter(isSliceableMesh), [files]);
  const selectedMesh = sliceableFiles.find((f) => f._id === selectedMeshId) || sliceableFiles[0];

  useEffect(() => {
    if (!sliceableFiles.length) {
      setSelectedMeshId('');
      return;
    }
    if (!sliceableFiles.some((f) => f._id === selectedMeshId)) {
      setSelectedMeshId(sliceableFiles[0]._id);
    }
  }, [sliceableFiles, selectedMeshId]);

  async function searchParts() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api.searchParts(query.trim()) as {
        parts?: StepPart[];
        items?: StepPart[];
        results?: StepPart[];
      };
      const list = data.parts || data.items || data.results || (Array.isArray(data) ? data : []);
      setParts(list);
      if (!list.length) onStatus('No matching parts in the catalog — try another search');
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Catalog search unavailable — try again');
    } finally {
      setSearching(false);
    }
  }

  async function importPart(part: StepPart) {
    const id = part.id || '';
    setImporting(id || part.name || 'part');
    try {
      await api.importPart({
        projectId,
        partId: id || undefined,
        partUrl: part.stepUrl,
        name: part.name || part.title,
      });
      onStatus(`Imported ${part.name || part.title || 'part'} into project`);
      onRefresh();
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Import failed — try again');
    } finally {
      setImporting('');
    }
  }

  function handleSliceSuccess(gcodeName: string) {
    onHighlightFile?.(gcodeName);
    setTab('files');
    onRefresh();
  }

  return (
    <aside className="w-60 border-l border-border bg-[#0d1a30] flex flex-col shrink-0 hidden lg:flex">
      <div className="h-10 border-b border-border flex text-[10px] font-medium uppercase tracking-wide">
        <button
          type="button"
          onClick={() => setTab('files')}
          className={`flex-1 flex items-center justify-center gap-1 ${
            tab === 'files' ? 'text-white bg-brand/20 border-b-2 border-brand-light' : 'text-muted hover:text-white'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          Files
        </button>
        <button
          type="button"
          onClick={() => setTab('slice')}
          className={`flex-1 flex items-center justify-center gap-1 ${
            tab === 'slice' ? 'text-white bg-brand/20 border-b-2 border-brand-light' : 'text-muted hover:text-white'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          Slice
        </button>
        <button
          type="button"
          onClick={() => setTab('parts')}
          className={`flex-1 flex items-center justify-center gap-1 ${
            tab === 'parts' ? 'text-white bg-brand/20 border-b-2 border-brand-light' : 'text-muted hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Parts
        </button>
      </div>

      {tab === 'parts' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2">
          <p className="text-[10px] text-muted px-0.5">step.parts catalog — fasteners, bearings, boards</p>
          <div className="flex gap-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchParts()}
              placeholder="M3 screw, 608 bearing…"
              className="flex-1 bg-panel border border-border rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-muted focus:outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={searchParts}
              disabled={searching}
              className="bg-brand hover:bg-brand-hover text-white px-2 py-1.5 rounded-lg"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {parts.map((part) => {
              const key = part.id || part.name || part.title || Math.random().toString();
              const label = part.name || part.title || part.id || 'Part';
              const busy = importing === (part.id || part.name);
              return (
                <div key={key} className="rounded-lg border border-border bg-panel/80 p-2 text-xs">
                  <p className="text-white truncate font-medium">{label}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => importPart(part)}
                    className="mt-2 w-full border border-brand/40 text-brand-muted hover:bg-brand/15 py-1.5 rounded-md flex items-center justify-center gap-1"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    Import STEP
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'slice' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2 overflow-y-auto">
          <p className="text-[10px] text-muted px-0.5">
            Slice STL or STEP to G-code. Output appears under Toolpaths.
          </p>
          {!sliceableFiles.length ? (
            <div className="rounded-lg border border-dashed border-border bg-panel/50 p-3 text-[11px] text-muted space-y-2">
              <FileBox className="w-5 h-5 text-muted/70" />
              <p className="text-white font-medium">No CAD model yet</p>
              <p>
                Generate a CAD model in chat first. STEP and STL exports will appear here when ready to slice.
              </p>
            </div>
          ) : (
            <>
              <label className="text-[10px] uppercase text-muted">Model to slice</label>
              <select
                value={selectedMesh?._id || ''}
                onChange={(e) => setSelectedMeshId(e.target.value)}
                className="w-full bg-panel border border-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
              >
                {sliceableFiles.map((file) => (
                  <option key={file._id} value={file._id}>
                    {file.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedMesh}
                onClick={() => setSliceModalOpen(true)}
                className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-xs py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Configure &amp; slice
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2 overflow-y-auto">
          <ProjectFilesList files={files} highlightName={highlightFile} />
        </div>
      )}

      {selectedMesh && (
        <SliceModal
          open={sliceModalOpen}
          projectId={projectId}
          file={selectedMesh}
          onClose={() => setSliceModalOpen(false)}
          onSuccess={handleSliceSuccess}
          onStatus={onStatus}
        />
      )}
    </aside>
  );
}
