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

function glbSidecarRelForStep(stepRel) {
  const dir = path.posix.dirname(stepRel);
  const base = path.posix.basename(stepRel);
  const glbName = `.${base}.glb`;
  return dir === '.' ? glbName : path.posix.join(dir, glbName);
}

function isInlineStepGlbSidecar(fileDoc, rel) {
  const name = fileDoc.name || path.posix.basename(rel);
  return kindForFile(fileDoc) === 'glb' && name.startsWith('.') && name.endsWith('.step.glb');
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
  const fileByRel = new Map();
  for (const file of files) {
    fileByRel.set(fileRefForDoc(file), file);
  }

  const entries = [];
  for (const file of files) {
    const rel = fileRefForDoc(file);
    const kind = kindForFile(file);

    if (isInlineStepGlbSidecar(file, rel)) {
      continue;
    }

    const url = await contentUrlForFile(file, { projectId, apiBase, usePresignedUrls });

    if (kind === 'step') {
      const glbRel = glbSidecarRelForStep(rel);
      const glbFile = fileByRel.get(glbRel);
      if (glbFile) {
        const glbUrl = await contentUrlForFile(glbFile, { projectId, apiBase, usePresignedUrls });
        entries.push({
          file: rel,
          kind: 'part',
          url: glbUrl,
          hash: '',
          bytes: glbFile.sizeBytes || file.sizeBytes || 0,
          sourceKind: 'step',
          source: {
            file: rel,
            url,
          },
          artifact: {
            ok: true,
            status: 'current',
            missing: false,
            stale: false,
            stepPath: rel,
            glbPath: glbRel,
            sourceKind: 'step',
          },
        });
        continue;
      }
    }

    entries.push({
      file: rel,
      kind,
      url,
      hash: '',
      bytes: file.sizeBytes || 0,
      ...(kind === 'step' ? { sourceKind: 'step' } : {}),
    });
  }

  entries.sort((a, b) => a.file.localeCompare(b.file));

  return {
    schemaVersion: 4,
    entries,
  };
}
