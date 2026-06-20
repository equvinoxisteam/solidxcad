'use client';

import { useMemo } from 'react';
import type { ProjectFile } from '@/lib/api';
import { CadViewerFrame } from '@/components/CadViewerFrame';

function viewerPrimaryRef(files: ProjectFile[]): string | undefined {
  const step = files.find((f) => f.kind === 'step' || /\.(step|stp)$/i.test(f.name));
  if (step) {
    return step.s3Key.includes('/models/') ? `models/${step.name}` : step.name;
  }
  const urdf = files.find((f) => f.kind === 'urdf' || /\.urdf$/i.test(f.name));
  if (urdf) {
    return urdf.s3Key.includes('/models/') ? `models/${urdf.name}` : urdf.name;
  }
  const implicit = files.find((f) => f.kind === 'implicit' || /\.implicit\.(js|mjs)$/i.test(f.name));
  if (implicit) {
    return implicit.s3Key.includes('/models/') ? `models/${implicit.name}` : implicit.name;
  }
  const stl = files.find((f) => f.kind === 'stl' || /\.stl$/i.test(f.name));
  if (stl) {
    return stl.s3Key.includes('/models/') ? `models/${stl.name}` : stl.name;
  }
  return undefined;
}

export function ModelViewer({
  projectId,
  files,
}: {
  projectId: string;
  files: ProjectFile[];
}) {
  const viewerRef = useMemo(() => viewerPrimaryRef(files), [files]);

  return (
    <div className="absolute inset-0 bg-white">
      {projectId && (
        <CadViewerFrame key={viewerRef || 'default'} projectId={projectId} fileRef={viewerRef} />
      )}
    </div>
  );
}
