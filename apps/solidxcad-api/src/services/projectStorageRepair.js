import path from 'path';
import { ProjectFile } from '../models/ProjectFile.js';
import { ChatMessage } from '../models/ChatMessage.js';
import {
  getObjectStream,
  isLocalStorageKey,
  s3ObjectKey,
  storageObjectExists,
} from './s3.js';
import { extractCadPython, regeneratePartFromPython } from './cadWorker.js';

const repairCache = new Map();
const REPAIR_TTL_MS = 60_000;

async function readStorageText(key) {
  const stream = await getObjectStream(key);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function normalizeProjectFileKeys(files) {
  let updated = 0;
  for (const file of files) {
    if (!file.s3Key || !isLocalStorageKey(file.s3Key)) continue;
    const cloudKey = s3ObjectKey(file.s3Key);
    if (cloudKey === file.s3Key) continue;
    if (await storageObjectExists(cloudKey)) {
      file.s3Key = cloudKey;
      await file.save();
      updated += 1;
    }
  }
  return updated;
}

async function findPythonCodeForPart({ projectId, partName, files }) {
  const scriptName = `${partName}.py`;
  const pyDoc = files.find((f) => f.name === scriptName);
  if (pyDoc?.s3Key && await storageObjectExists(pyDoc.s3Key)) {
    return readStorageText(pyDoc.s3Key);
  }

  const messages = await ChatMessage.find({ projectId, role: 'assistant' })
    .sort({ createdAt: -1 })
    .limit(40);

  for (const msg of messages) {
    const code = extractCadPython(msg.content);
    if (!code) continue;
    if (msg.content.includes(partName) || msg.content.includes(scriptName)) {
      return code;
    }
  }

  for (const msg of messages) {
    const code = extractCadPython(msg.content);
    if (code) return code;
  }

  return null;
}

export async function repairProjectStorage({
  userId,
  projectId,
  onProgress = () => {},
  force = false,
}) {
  const cacheKey = `${userId}:${projectId}`;
  const cached = repairCache.get(cacheKey);
  if (!force && cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const files = await ProjectFile.find({ projectId, userId }).sort({ createdAt: 1 });
  const result = {
    normalizedKeys: 0,
    regenerated: [],
    stillMissing: [],
  };

  result.normalizedKeys = await normalizeProjectFileKeys(files);

  const missingSteps = [];
  for (const file of files) {
    if (file.kind !== 'step' && !/\.step$/i.test(file.name)) continue;
    const exists = file.s3Key ? await storageObjectExists(file.s3Key) : false;
    if (!exists) {
      missingSteps.push(file);
    }
  }

  for (const stepDoc of missingSteps) {
    const partName = path.basename(stepDoc.name, path.extname(stepDoc.name));
    const pythonCode = await findPythonCodeForPart({ projectId, partName, files });
    if (!pythonCode) {
      result.stillMissing.push(stepDoc.name);
      continue;
    }

    onProgress(`Repairing missing cloud file ${stepDoc.name}…`);
    const regen = await regeneratePartFromPython({
      userId,
      projectId,
      partName,
      pythonCode,
      onProgress,
    });
    if (regen.ok) {
      result.regenerated.push(stepDoc.name);
    } else {
      result.stillMissing.push(stepDoc.name);
      console.warn(`[storage-repair] ${stepDoc.name}:`, regen.error);
    }
  }

  repairCache.set(cacheKey, {
    expires: Date.now() + REPAIR_TTL_MS,
    result,
  });
  return result;
}

export async function repairProjectStorageIfNeeded({
  userId,
  projectId,
  onProgress = () => {},
}) {
  const files = await ProjectFile.find({ projectId, userId });
  let needsRepair = false;
  for (const file of files) {
    if (!file.s3Key) {
      needsRepair = true;
      break;
    }
    if (isLocalStorageKey(file.s3Key)) {
      needsRepair = true;
      break;
    }
    if (!(await storageObjectExists(file.s3Key))) {
      needsRepair = true;
      break;
    }
  }
  if (!needsRepair) return { skipped: true };
  return repairProjectStorage({ userId, projectId, onProgress });
}
