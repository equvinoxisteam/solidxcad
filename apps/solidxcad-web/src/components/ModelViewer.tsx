'use client';

import { useMemo } from 'react';
import { Box, Download } from 'lucide-react';
import type { ProjectFile } from '@/lib/api';
import { MeshPreview } from '@/components/MeshPreview';
import { CadViewerFrame } from '@/components/CadViewerFrame';
import type { StudioViewMode } from '@/components/StudioTopBar';

function previewMeshFile(files: ProjectFile[]): ProjectFile | null {
  return files.find((f) => f.kind === 'stl' || f.kind === 'glb') || files[0] || null;
}

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
  mode,
}: {
  projectId: string;
  files: ProjectFile[];
  mode: StudioViewMode;
  onModeChange?: (mode: StudioViewMode) => void;
}) {
  const mesh = useMemo(() => previewMeshFile(files), [files]);
  const viewerRef = useMemo(() => viewerPrimaryRef(files), [files]);
  const downloadFile = useMemo(() => {
    return files.find((f) => f.kind === 'step' || f.kind === 'urdf' || f.kind === 'stl') || files[0];
  }, [files]);

  return (
    <div className="flex-1 flex flex-col bg-base relative min-h-0 studio-viewport">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {mode === 'mesh' ? (
          <>
            <div className="absolute inset-0 studio-viewport-grid pointer-events-none" />
            {mesh && projectId ? (
              <MeshPreview
                projectId={projectId}
                fileId={mesh._id}
                fileName={mesh.name}
                kind={mesh.kind}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
                <div className="text-center max-w-md">
                  <Box className="w-14 h-14 text-brand/40 mx-auto mb-4" />
                  <p className="text-white/80 text-sm font-medium mb-1">Mesh preview</p>
                  <p className="text-muted text-xs leading-relaxed">
                    Describe a part in the Design Assistant. Your STL or GLB preview will appear here.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          projectId && (
            <CadViewerFrame key={viewerRef || 'default'} projectId={projectId} fileRef={viewerRef} />
          )
        )}
      </div>

      {downloadFile?.downloadUrl && (
        <div className="border-t border-border bg-[#0a1628]/90 px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-muted font-mono truncate">
            {mode === 'viewer' ? 'CAD Workbench' : 'Mesh'} · {downloadFile.name}
          </span>
          <a
            href={downloadFile.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs flex items-center gap-1.5 py-1 px-2 rounded-md text-brand-muted hover:text-white hover:bg-brand/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      )}
    </div>
  );
}
