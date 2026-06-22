'use client';

import { Download, FileBox, FolderOpen, Layers } from 'lucide-react';
import type { ProjectFile } from '@/lib/api';
import { isUserVisibleFile } from '@/lib/agentDisplay';

function folderFor(file: ProjectFile): 'models' | 'assemblies' | 'parts' | 'slices' | 'other' {
  if (file.s3Key?.includes('/slices/') || file.kind === 'gcode' || /\.gcode$/i.test(file.name)) {
    return 'slices';
  }
  if (file.s3Key?.includes('/assemblies/')) return 'assemblies';
  if (file.s3Key?.includes('/parts/')) return 'parts';
  if (file.s3Key?.includes('/models/')) return 'models';
  return 'other';
}

type FolderKey = 'models' | 'assemblies' | 'parts' | 'slices' | 'other';

const FOLDER_LABELS: Record<FolderKey, string> = {
  models: 'Models',
  assemblies: 'Assemblies',
  parts: 'Catalog parts',
  slices: 'Toolpaths (G-code & 3MF)',
  other: 'Other',
};

export function ProjectFilesList({
  files,
  highlightName,
}: {
  files: ProjectFile[];
  highlightName?: string;
}) {
  const grouped: Record<FolderKey, ProjectFile[]> = {
    models: [],
    assemblies: [],
    parts: [],
    slices: [],
    other: [],
  };

  for (const file of files) {
    if (file.name.startsWith('.')) continue;
    if (!isUserVisibleFile(file.name, file.kind)) continue;
    grouped[folderFor(file)].push(file);
  }

  const order: FolderKey[] = ['models', 'assemblies', 'parts', 'slices', 'other'];
  const hasAny = order.some((k) => grouped[k].length > 0);

  if (!hasAny) {
    return (
      <p className="text-[10px] text-muted px-1">
        No project files yet. Generate a part in chat or import from Parts tab.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {order.map((key) => {
        const list = grouped[key];
        if (!list.length) return null;
        return (
          <div key={key}>
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted mb-1">
              <FolderOpen className="w-3 h-3" />
              {FOLDER_LABELS[key]}
            </div>
            <ul className="space-y-1">
              {list.map((file) => {
                const highlighted = highlightName && file.name === highlightName;
                return (
                  <li
                    key={file._id}
                    className={`rounded border px-2 py-1.5 text-[11px] flex items-start gap-1.5 ${
                      highlighted
                        ? 'border-accent/50 bg-accent/10'
                        : 'border-border bg-panel'
                    }`}
                  >
                    {file.kind === 'gcode' || /\.gcode$/i.test(file.name) ? (
                      <Layers className="w-3 h-3 shrink-0 text-orange-500 mt-0.5" />
                    ) : file.kind === '3mf' || /\.3mf$/i.test(file.name) ? (
                      <Layers className="w-3 h-3 shrink-0 text-violet-500 mt-0.5" />
                    ) : (
                      <FileBox className="w-3 h-3 shrink-0 text-muted mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-gray-800 font-mono">{file.name}</p>
                      <p className="text-[10px] text-muted">{file.kind || 'file'}</p>
                    </div>
                    {file.downloadUrl && (
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted hover:text-gray-900"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
