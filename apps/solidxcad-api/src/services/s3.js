import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { config } from '../config.js';

const LOCAL_KEY_PREFIX = 'local:';

const client = new S3Client({
  region: config.aws.region,
  credentials: config.aws.accessKeyId
    ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      }
    : undefined,
});

function userPrefix(userId, projectId) {
  return `${config.aws.prefix}/users/${userId}/projects/${projectId}`;
}

export function isLocalStorageKey(key) {
  return String(key).startsWith(LOCAL_KEY_PREFIX);
}

function localStorageRoot() {
  return path.join(config.textToCadRoot, 'tmp', 'solidxcad-storage');
}

function localPathForKey(key) {
  const rel = isLocalStorageKey(key) ? key.slice(LOCAL_KEY_PREFIX.length) : key;
  return path.join(localStorageRoot(), rel);
}

function toLocalKey(key) {
  return isLocalStorageKey(key) ? key : `${LOCAL_KEY_PREFIX}${key}`;
}

function shouldUseLocalStorageOnly() {
  return config.storageBackend === 'local' || !config.aws.bucket;
}

function shouldFallbackToLocal(err) {
  if (config.storageBackend === 's3') return false;
  if (config.nodeEnv !== 'development') return false;
  const name = err?.name || '';
  const message = String(err?.message || '');
  return name === 'AccessDenied'
    || name === 'InvalidAccessKeyId'
    || name === 'SignatureDoesNotMatch'
    || message.includes('Access Denied')
    || message.includes('not authorized');
}

async function writeLocalFile(key, body) {
  const dest = localPathForKey(key);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  if (Buffer.isBuffer(body)) {
    await fsp.writeFile(dest, body);
    return;
  }
  if (typeof body?.pipe === 'function') {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      body.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      body.on('error', reject);
    });
    return;
  }
  await fsp.writeFile(dest, body);
}

async function uploadLocal(key, body) {
  const storageKey = toLocalKey(key);
  await writeLocalFile(storageKey, body);
  console.log(`[storage] saved locally: ${storageKey}`);
  return { url: publicUrlForKey(storageKey), key: storageKey };
}

function uploadResult(url, key) {
  return { url, key };
}

export function buildS3Key(userId, projectId, filename) {
  return `${userPrefix(userId, projectId)}/${filename}`;
}

export async function uploadBuffer(key, buffer, contentType) {
  if (shouldUseLocalStorageOnly()) {
    return uploadLocal(key, buffer);
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.aws.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return uploadResult(publicUrlForKey(key), key);
  } catch (err) {
    if (!shouldFallbackToLocal(err)) throw err;
    console.warn('[storage] S3 upload failed, using local storage:', err.message);
    return uploadLocal(key, buffer);
  }
}

export async function uploadFile(key, filePath, contentType) {
  if (shouldUseLocalStorageOnly()) {
    const body = fs.createReadStream(filePath);
    return uploadLocal(key, body);
  }

  const body = fs.createReadStream(filePath);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.aws.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return uploadResult(publicUrlForKey(key), key);
  } catch (err) {
    if (!shouldFallbackToLocal(err)) throw err;
    console.warn('[storage] S3 upload failed, using local storage:', err.message);
    const data = await fsp.readFile(filePath);
    return uploadLocal(key, data);
  }
}

export function publicUrlForKey(key) {
  if (isLocalStorageKey(key)) {
    return `${config.apiUrl}/api/assets/local?key=${encodeURIComponent(key)}`;
  }
  if (config.aws.cloudfront) {
    return `${config.aws.cloudfront}/${key}`;
  }
  if (config.aws.publicUrl) {
    return `${config.aws.publicUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
}

export async function getSignedDownloadUrl(key, expiresIn = 900) {
  if (isLocalStorageKey(key)) {
    return publicUrlForKey(key);
  }
  const command = new GetObjectCommand({ Bucket: config.aws.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

export async function listProjectFiles(userId, projectId) {
  const prefix = `${userPrefix(userId, projectId)}/`;
  if (shouldUseLocalStorageOnly()) {
    const root = localPathForKey(toLocalKey(prefix));
    try {
      const walk = async (dir, rel = '') => {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
          const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...await walk(full, entryRel));
          } else {
            const key = toLocalKey(`${prefix}${entryRel.replace(/\\/g, '/')}`);
            const stat = await fsp.stat(full);
            files.push({
              key,
              name: entry.name,
              size: stat.size,
              lastModified: stat.mtime,
              url: publicUrlForKey(key),
            });
          }
        }
        return files;
      };
      return walk(root);
    } catch {
      return [];
    }
  }

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.aws.bucket,
      Prefix: prefix,
    }),
  );

  return (result.Contents || []).map((obj) => ({
    key: obj.Key,
    name: path.basename(obj.Key),
    size: obj.Size,
    lastModified: obj.LastModified,
    url: publicUrlForKey(obj.Key),
  }));
}

export async function deleteStorageKey(key) {
  if (!key) return;
  if (isLocalStorageKey(key)) {
    try {
      await fsp.unlink(localPathForKey(key));
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    return;
  }
  if (!config.aws.bucket) return;
  await client.send(new DeleteObjectCommand({ Bucket: config.aws.bucket, Key: key }));
}

export async function deleteProjectStorage(userId, projectId) {
  const prefix = `${userPrefix(userId, projectId)}/`;
  const files = await listProjectFiles(userId, projectId);
  for (const file of files) {
    await deleteStorageKey(file.key);
  }

  if (shouldUseLocalStorageOnly()) {
    const root = localPathForKey(toLocalKey(prefix));
    await fsp.rm(root, { recursive: true, force: true });
    return;
  }

  if (!config.aws.bucket) return;
  const keys = files.map((f) => ({ Key: f.key })).filter((f) => f.Key && !isLocalStorageKey(f.Key));
  if (!keys.length) return;
  await client.send(new DeleteObjectsCommand({
    Bucket: config.aws.bucket,
    Delete: { Objects: keys },
  }));
}

function s3ObjectKey(key) {
  return isLocalStorageKey(key) ? key.slice(LOCAL_KEY_PREFIX.length) : key;
}

function isMissingObjectError(err) {
  const name = err?.name || '';
  const code = err?.code || '';
  return name === 'NoSuchKey'
    || name === 'NotFound'
    || code === 'ENOENT'
    || code === 'NotFound';
}

async function readLocalKeyStream(key) {
  const localKey = isLocalStorageKey(key) ? key : toLocalKey(key);
  const data = await fsp.readFile(localPathForKey(localKey));
  return Readable.from(data);
}

async function readS3ObjectStream(key) {
  if (!config.aws.bucket) {
    const err = new Error('S3 bucket not configured');
    err.status = 503;
    throw err;
  }
  const result = await client.send(
    new GetObjectCommand({ Bucket: config.aws.bucket, Key: s3ObjectKey(key) }),
  );
  if (!result.Body) {
    const err = new Error('Empty S3 object body');
    err.status = 502;
    throw err;
  }
  return result.Body;
}

export async function getObjectStream(key) {
  if (!key) {
    const err = new Error('Missing storage key');
    err.status = 404;
    throw err;
  }

  const preferLocal = isLocalStorageKey(key) || shouldUseLocalStorageOnly();
  if (preferLocal) {
    try {
      return await readLocalKeyStream(key);
    } catch (localErr) {
      if (config.aws.bucket && config.storageBackend !== 'local') {
        try {
          return await readS3ObjectStream(key);
        } catch (s3Err) {
          if (isMissingObjectError(s3Err) && isMissingObjectError(localErr)) {
            const err = new Error('File not found in storage');
            err.status = 404;
            throw err;
          }
          throw s3Err;
        }
      }
      if (isMissingObjectError(localErr)) {
        const err = new Error('File not found in storage');
        err.status = 404;
        throw err;
      }
      throw localErr;
    }
  }

  try {
    return await readS3ObjectStream(key);
  } catch (s3Err) {
    if (shouldFallbackToLocal(s3Err) || isMissingObjectError(s3Err)) {
      try {
        return await readLocalKeyStream(key);
      } catch (localErr) {
        if (isMissingObjectError(localErr) && isMissingObjectError(s3Err)) {
          const err = new Error('File not found in storage');
          err.status = 404;
          throw err;
        }
        throw s3Err;
      }
    }
    throw s3Err;
  }
}
