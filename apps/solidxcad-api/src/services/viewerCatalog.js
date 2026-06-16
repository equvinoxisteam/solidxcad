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

function catalogHashForFile(fileDoc) {
  const bytes = Number(fileDoc?.sizeBytes);
  const safeBytes = Number.isFinite(bytes) && bytes >= 0 ? Math.trunc(bytes) : 0;
  const updatedAt = fileDoc?.updatedAt ? new Date(fileDoc.updatedAt).getTime() : 0;
  const createdAt = fileDoc?.createdAt ? new Date(fileDoc.createdAt).getTime() : 0;
  const stamp = updatedAt || createdAt;
  if (safeBytes > 0 || stamp > 0) {
    return `${safeBytes.toString(36)}-${stamp.toString(36)}`;
  }
  const key = String(fileDoc?.s3Key || fileDoc?.name || '').trim();
  return key || 'v1';
}

function publicContentUrlForFile(rel, { apiBase, catalogToken }) {
  const params = new URLSearchParams();
  params.set('token', catalogToken);
  params.set('file', rel);
  return `${apiBase}/api/viewer/public/content?${params.toString()}`;
}

async function contentUrlForFile(file, {
  projectId,
  apiBase,
  usePresignedUrls,
  catalogToken = '',
}) {
  const rel = fileRefForDoc(file);
  const canPresign = usePresignedUrls
    && file.s3Key
    && !isLocalStorageKey(file.s3Key);
  if (canPresign) {
    return getSignedDownloadUrl(file.s3Key, 3600);
  }
  if (catalogToken) {
    return publicContentUrlForFile(rel, { apiBase, catalogToken });
  }
  return `${apiBase}/api/viewer/projects/${projectId}/content?file=${encodeURIComponent(rel)}`;
}

export async function buildProjectCatalog(files, {
  projectId,
  apiBase,
  usePresignedUrls = false,
  catalogToken = '',
}) {
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

    const url = await contentUrlForFile(file, {
      projectId, apiBase, usePresignedUrls, catalogToken,
    });

    if (kind === 'step') {
      const glbRel = glbSidecarRelForStep(rel);
      const glbFile = fileByRel.get(glbRel);
      if (glbFile) {
        const glbUrl = await contentUrlForFile(glbFile, {
          projectId, apiBase, usePresignedUrls, catalogToken,
        });
        entries.push({
          file: rel,
          kind: 'part',
          url: glbUrl,
          hash: catalogHashForFile(glbFile),
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
      hash: catalogHashForFile(file),
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
