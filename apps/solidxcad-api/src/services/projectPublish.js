import { Project } from '../models/Project.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { filterUserVisibleFiles } from './projectFileVisibility.js';

export function pickPreviewFile(files = []) {
  const score = (file) => {
    const name = String(file?.name || '').toLowerCase();
    const kind = String(file?.kind || '').toLowerCase();
    if (kind === 'stl' || name.endsWith('.stl')) return 0;
    if (kind === 'glb' || name.endsWith('.glb')) return 1;
    if (kind === 'step' || name.endsWith('.step') || name.endsWith('.stp')) return 2;
    return 9;
  };
  const list = [...files].filter((f) => score(f) < 9);
  if (!list.length) return null;
  list.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return list[0];
}

export async function publishProject(project) {
  const files = await ProjectFile.find({ projectId: project._id });
  const visible = filterUserVisibleFiles(files);
  if (!visible.length) {
    const err = new Error('Add at least one model file (STEP, STL, or GLB) before publishing');
    err.status = 400;
    throw err;
  }

  const preview = pickPreviewFile(visible);
  project.isPublic = true;
  project.publishedAt = new Date();
  project.previewFileId = preview?._id || null;
  await project.save();
  return project;
}

export async function unpublishProject(project) {
  project.isPublic = false;
  await project.save();
  return project;
}

export function previewFileMeta(file) {
  if (!file) return null;
  return {
    _id: file._id,
    name: file.name,
    kind: file.kind || 'file',
  };
}

export async function enrichProjectWithPreview(projectDoc, { includePrivate = false } = {}) {
  const project = projectDoc?.toObject ? projectDoc.toObject() : { ...projectDoc };
  let file = null;

  if (project.previewFileId) {
    file = await ProjectFile.findById(project.previewFileId).select('name kind projectId updatedAt createdAt');
    if (!file || String(file.projectId) !== String(project._id)) {
      file = null;
    }
  }

  if (!file) {
    const files = await ProjectFile.find({ projectId: project._id }).sort({ updatedAt: -1, createdAt: -1 });
    const visible = filterUserVisibleFiles(files);
    file = pickPreviewFile(visible);
  }

  project.previewFile = file ? previewFileMeta(file) : null;

  if (!includePrivate) {
    delete project.lastPrompt;
    delete project.userId;
  }
  return project;
}
