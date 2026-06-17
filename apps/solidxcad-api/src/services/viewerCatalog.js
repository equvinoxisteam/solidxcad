import path from 'path';
import { fileRefForDoc, stepGlbRelCandidates } from './projectWorkspace.js';
import { filterUserVisibleFiles } from './projectFileVisibility.js';
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

function glbRelCandidatesForStep(stepRel) {
  return stepGlbRelCandidates(stepRel);
}

function isInlineStepGlbSidecar(fileDoc, rel) {
  const name = fileDoc.name || path.posix.basename(rel);
  return kindForFile(fileDoc) === 'glb' && name.startsWith('.') && name.endsWith('.step.glb');
}

function isStepCompanionGlb(fileDoc, rel, fileByRel) {
  if (kindForFile(fileDoc) !== 'glb') return false;
  if (isInlineStepGlbSidecar(fileDoc, rel)) return true;
  const base = path.posix.basename(rel, '.glb');
  const dir = path.posix.dirname(rel);
  const stepRel = dir === '.' ? `${base}.step` : path.posix.join(dir, `${base}.step`);
  return fileByRel.has(stepRel);
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

function publicStepModuleUrl(stepRel, { apiBase, catalogToken }) {
  const params = new URLSearchParams();
  params.set('token', catalogToken);
  params.set('step', stepRel);
  return `${apiBase}/api/viewer/public/step-module?${params.toString()}`;
}

function companionPythonRelForStep(stepRel, fileByRel) {
  const dir = path.posix.dirname(stepRel);
  const base = path.posix.basename(stepRel, path.extname(stepRel));
  const pyRel = dir === '.' ? `${base}.py` : path.posix.join(dir, `${base}.py`);
  return fileByRel.has(pyRel) ? pyRel : '';
}

  const byFile = new Map();
  for (const entry of entries) {
    const file = String(entry?.file || '').trim();
    if (!file) continue;
    const existing = byFile.get(file);
    if (!existing) {
      byFile.set(file, entry);
      continue;
    }
    const preferNew = entry.kind === 'part' && existing.kind !== 'part';
    if (preferNew) {
      byFile.set(file, entry);
    }
  }
  return [...byFile.values()];
}

async function contentUrlForFile(file, {
  projectId,
  apiBase,
  usePresignedUrls,
  catalogToken = '',
}) {
  const rel = fileRefForDoc(file);
  // Tokenized catalog is loaded by the hosted CAD viewer on another origin;
  // always proxy through the API so S3 bucket CORS is not required.
  if (catalogToken) {
    return publicContentUrlForFile(rel, { apiBase, catalogToken });
  }
  const canPresign = usePresignedUrls
    && file.s3Key
    && !isLocalStorageKey(file.s3Key);
  if (canPresign) {
    return getSignedDownloadUrl(file.s3Key, 3600);
  }
  return `${apiBase}/api/viewer/projects/${projectId}/content?file=${encodeURIComponent(rel)}`;
}

export async function buildProjectCatalog(files, {
  projectId,
  apiBase,
  usePresignedUrls = false,
  catalogToken = '',
}) {
  const visibleFiles = filterUserVisibleFiles(files);
  const fileByRel = new Map();
  for (const file of visibleFiles) {
    fileByRel.set(fileRefForDoc(file), file);
  }

  const entries = [];
  for (const file of visibleFiles) {
    const rel = fileRefForDoc(file);
    const kind = kindForFile(file);

    if (isInlineStepGlbSidecar(file, rel)) {
      continue;
    }

    if (isStepCompanionGlb(file, rel, fileByRel)) {
      continue;
    }

    const url = await contentUrlForFile(file, {
      projectId, apiBase, usePresignedUrls, catalogToken,
    });

    if (kind === 'step') {
      let glbFile = null;
      let glbRel = '';
      for (const candidate of glbRelCandidatesForStep(rel)) {
        const found = fileByRel.get(candidate);
        if (found) {
          glbFile = found;
          glbRel = candidate;
          break;
        }
      }
      if (glbFile) {
        const glbUrl = await contentUrlForFile(glbFile, {
          projectId, apiBase, usePresignedUrls, catalogToken,
        });
        const hasPythonCompanion = Boolean(companionPythonRelForStep(rel, fileByRel));
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
          ...(catalogToken && hasPythonCompanion
            ? { moduleUrl: publicStepModuleUrl(rel, { apiBase, catalogToken }) }
            : {}),
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

    if (kind === 'step') {
      continue;
    }

    entries.push({
      file: rel,
      kind,
      url,
      hash: catalogHashForFile(file),
      bytes: file.sizeBytes || 0,
    });
  }

  entries.sort((a, b) => a.file.localeCompare(b.file));
  const dedupedEntries = dedupeCatalogEntries(entries);

  return {
    schemaVersion: 4,
    entries: dedupedEntries,
  };
}
