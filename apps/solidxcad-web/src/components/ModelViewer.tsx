'use client';

import { useMemo } from 'react';
import type { ProjectFile } from '@/lib/api';
import { CadViewerFrame } from '@/components/CadViewerFrame';

function fileRefFor(file: ProjectFile): string {
  if (file.s3Key?.includes('/models/')) return `models/${file.name}`;
  if (file.s3Key?.includes('/assemblies/')) return `assemblies/${file.name}`;
  if (file.s3Key?.includes('/parts/')) return `parts/${file.name}`;
  return file.name;
}

function viewerPrimaryRef(files: ProjectFile[], preferName?: string): string | undefined {
  if (preferName) {
    const match = files.find((f) => f.name === preferName);
    if (match) return fileRefFor(match);
  }

  const pickNewest = (predicate: (f: ProjectFile) => boolean) => {
    const list = files.filter(predicate);
    if (!list.length) return undefined;
    list.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
    return fileRefFor(list[0]);
  };

  return (
    pickNewest((f) => f.kind === 'step' || /\.(step|stp)$/i.test(f.name))
    || pickNewest((f) => f.kind === 'urdf' || /\.urdf$/i.test(f.name))
    || pickNewest((f) => f.kind === 'implicit' || /\.implicit\.(js|mjs)$/i.test(f.name))
    || pickNewest((f) => f.kind === 'stl' || /\.stl$/i.test(f.name))
  );
}

export function ModelViewer({
  projectId,
  files,
  highlightFile = '',
  viewerReloadKey = 0,
}: {
  projectId: string;
  files: ProjectFile[];
  highlightFile?: string;
  viewerReloadKey?: number;
}) {
  const viewerRef = useMemo(
    () => viewerPrimaryRef(files, highlightFile),
    [files, highlightFile],
  );

  return (
    <div className="studio-viewer-canvas">
      {projectId && (
        <CadViewerFrame
          projectId={projectId}
          fileRef={viewerRef}
          reloadToken={viewerReloadKey}
        />
      )}
    </div>
  );
}
