import path from 'path';
import { fileRefForDoc } from './projectWorkspace.js';
import { getSignedDownloadUrl, isLocalStorageKey } from './s3.js';

const KIND_MAP = {
  step: 'step',
  stp: 'step',
  stl: 'stl',
  glb: 'glb',
  gcode: 'gcode',
  '3mf': '3mf',
  dxf: 'dxf',
  urdf: 'urdf',
  srdf: 'srdf',
  sdf: 'sdf',
};

function kindForFile(fileDoc) {
  if (fileDoc.kind && fileDoc.kind !== 'other') {
    if (fileDoc.kind === 'implicit') return 'implicit';
    return KIND_MAP[fileDoc.kind] || fileDoc.kind;
  }
  const ext = path.extname(fileDoc.name).slice(1).toLowerCase();
  return KIND_MAP[ext] || 'other';
}

async function contentUrlForFile(file, { projectId, apiBase, usePresignedUrls }) {
  const rel = fileRefForDoc(file);
  if (
    usePresignedUrls
    && file.s3Key
    && !isLocalStorageKey(file.s3Key)
  ) {
    return getSignedDownloadUrl(file.s3Key, 3600);
  }
  return `${apiBase}/api/viewer/projects/${projectId}/content?file=${encodeURIComponent(rel)}`;
}

export async function buildProjectCatalog(files, { projectId, apiBase, usePresignedUrls = false }) {
  const entries = await Promise.all(files.map(async (file) => {
    const rel = fileRefForDoc(file);
    const kind = kindForFile(file);
    const url = await contentUrlForFile(file, { projectId, apiBase, usePresignedUrls });
    return {
      file: rel,
      kind,
      url,
      hash: '',
      bytes: file.sizeBytes || 0,
      ...(kind === 'step' ? { sourceKind: 'step' } : {}),
    };
  }));

  entries.sort((a, b) => a.file.localeCompare(b.file));

  return {
    schemaVersion: 4,
    entries,
  };
}
