import path from 'path';
import { ProjectFile } from '../models/ProjectFile.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { getObjectStream, storageObjectExists } from '../services/s3.js';
import { extractCadPython } from './cadWorker.js';

async function readStorageText(key) {
  const stream = await getObjectStream(key);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function resolvePythonSourceForStep({
  projectId,
  userId,
  stepFileName,
  projectFiles = null,
}) {
  const partName = path.basename(stepFileName, path.extname(stepFileName));
  const pyName = `${partName}.py`;
  const files = projectFiles || await ProjectFile.find({ projectId, userId }).sort({ createdAt: 1 });

  const pyDoc = files.find((f) => f.name === pyName);
  if (pyDoc?.s3Key && await storageObjectExists(pyDoc.s3Key)) {
    return { source: await readStorageText(pyDoc.s3Key), partName, pyDoc };
  }

  const messages = await ChatMessage.find({ projectId, role: 'assistant' })
    .sort({ createdAt: -1 })
    .limit(40);

  for (const msg of messages) {
    const code = extractCadPython(msg.content);
    if (!code) continue;
    if (msg.content.includes(partName) || msg.content.includes(pyName)) {
      return { source: code, partName, pyDoc: null };
    }
  }

  for (const msg of messages) {
    const code = extractCadPython(msg.content);
    if (code) return { source: code, partName, pyDoc: null };
  }

  return { source: null, partName, pyDoc: null };
}
