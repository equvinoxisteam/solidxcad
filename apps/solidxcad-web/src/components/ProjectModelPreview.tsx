'use client';

import { useMemo } from 'react';
import { MeshPreview } from '@/components/MeshPreview';
import type { Project, ProjectFile, PublicProject, PublicProjectFile } from '@/lib/api';
import { isUserVisibleFile } from '@/lib/agentDisplay';

type PreviewSource = {
  projectId: string;
  fileId: string;
  fileName: string;
  kind: string;
  publicMode?: boolean;
};

function pickMeshFile(files: ProjectFile[]): ProjectFile | null {
  const visible = files.filter((f) => isUserVisibleFile(f.name, f.kind) && !f.name.startsWith('.'));
  const score = (f: ProjectFile) => {
    const n = f.name.toLowerCase();
    if (n.endsWith('.stl') || f.kind === 'stl') return 0;
    if (n.endsWith('.glb') || f.kind === 'glb') return 1;
    return 9;
  };
  const meshes = visible.filter((f) => score(f) < 9);
  if (!meshes.length) return null;
  meshes.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return meshes[0];
}

export function resolveProjectPreview(
  project: Project | PublicProject | null,
  files: (ProjectFile | PublicProjectFile)[] = [],
): PreviewSource | null {
  if (project?.previewFile?._id) {
    return {
      projectId: project._id,
      fileId: project.previewFile._id,
      fileName: project.previewFile.name,
      kind: project.previewFile.kind,
    };
  }
  const mesh = pickMeshFile(files as ProjectFile[]);
  if (!mesh) return null;
  return {
    projectId: project?._id || '',
    fileId: mesh._id,
    fileName: mesh.name,
    kind: mesh.kind,
  };
}

export function ProjectModelPreview({
  project,
  files = [],
  publicMode = false,
  className = '',
}: {
  project: Project | PublicProject | null;
  files?: (ProjectFile | PublicProjectFile)[];
  publicMode?: boolean;
  className?: string;
}) {
  const source = useMemo(() => resolveProjectPreview(project, files), [project, files]);

  if (!source?.projectId || !source.fileId) {
    return (
      <div className={`flex items-center justify-center bg-elevated text-xs text-muted ${className}`}>
        No STL/GLB preview yet
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#0a1628] ${className}`}>
      <MeshPreview
        projectId={source.projectId}
        fileId={source.fileId}
        fileName={source.fileName}
        kind={source.kind}
        publicMode={publicMode}
      />
    </div>
  );
}
