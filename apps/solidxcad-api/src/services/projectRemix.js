import path from 'path';
import { Project } from '../models/Project.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { User } from '../models/User.js';
import { filterUserVisibleFiles } from './projectFileVisibility.js';
import { pickPreviewFile } from './projectPublish.js';
import { buildS3Key, copyStorageObject } from './s3.js';

function relativeStoragePath(s3Key = '') {
  const key = String(s3Key);
  const modelsIdx = key.indexOf('/models/');
  if (modelsIdx >= 0) return key.slice(modelsIdx + 1);
  const assembliesIdx = key.indexOf('/assemblies/');
  if (assembliesIdx >= 0) return key.slice(assembliesIdx + 1);
  const partsIdx = key.indexOf('/parts/');
  if (partsIdx >= 0) return key.slice(partsIdx + 1);
  const slicesIdx = key.indexOf('/slices/');
  if (slicesIdx >= 0) return key.slice(slicesIdx + 1);
  return path.posix.basename(key);
}

export async function remixPublicProject({ sourceProjectId, userId, name }) {
  const source = await Project.findOne({ _id: sourceProjectId, isPublic: true });
  if (!source) {
    const err = new Error('Public project not found');
    err.status = 404;
    throw err;
  }

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    const err = new Error('Project name required');
    err.status = 400;
    throw err;
  }

  const sourceOwner = await User.findById(source.userId).select('name');
  const description = source.description
    || `Remix of ${source.name}${sourceOwner?.name ? ` by ${sourceOwner.name}` : ''}`;

  const newProject = await Project.create({
    userId,
    name: trimmedName,
    description,
    remixOf: source._id,
    lastPrompt: source.lastPrompt || '',
    isPublic: false,
  });

  const sourceFiles = await ProjectFile.find({ projectId: source._id });
  const visible = filterUserVisibleFiles(sourceFiles);
  const sourcePreview = visible.find((f) => String(f._id) === String(source.previewFileId));
  let previewFileId = null;

  for (const file of visible) {
    const rel = relativeStoragePath(file.s3Key);
    const destKey = buildS3Key(userId, newProject._id, rel);
    await copyStorageObject(file.s3Key, destKey, file.mimeType || 'application/octet-stream');
    const doc = await ProjectFile.create({
      projectId: newProject._id,
      userId,
      name: file.name,
      s3Key: destKey,
      mimeType: file.mimeType || 'application/octet-stream',
      kind: file.kind || 'other',
      sizeBytes: file.sizeBytes || 0,
    });
    if (sourcePreview && file.name === sourcePreview.name) {
      previewFileId = doc._id;
    }
  }

  if (!previewFileId) {
    const picked = pickPreviewFile(
      await ProjectFile.find({ projectId: newProject._id }),
    );
    previewFileId = picked?._id || null;
  }

  if (previewFileId) {
    newProject.previewFileId = previewFileId;
    await newProject.save();
  }

  await Project.updateOne({ _id: source._id }, { $inc: { remixCount: 1 } });

  return newProject;
}
