import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { buildS3Key, uploadFile } from './s3.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { skillMeta } from './skillRegistry.js';
import { exportImplicitFormat, uploadSidecarIfExists } from './cadExportService.js';
import { generateImplicitCodeFromPlan } from './openrouter.js';
import { detectFromScratchBuild } from './cadPythonPresets.js';

async function upsertProjectFile({
  projectId,
  userId,
  name,
  s3Key,
  mimeType,
  kind,
  sizeBytes,
}) {
  const existing = await ProjectFile.findOne({ projectId, userId, name });
  if (existing) {
    existing.s3Key = s3Key;
    existing.mimeType = mimeType;
    existing.kind = kind;
    if (sizeBytes != null) existing.sizeBytes = sizeBytes;
    await existing.save();
    return existing;
  }
  return ProjectFile.create({
    projectId,
    userId,
    name,
    s3Key,
    mimeType,
    kind,
    sizeBytes,
  });
}

function extractImplicitModule(text) {
  const blocks = [...text.matchAll(/```(?:javascript|js|mjs)?\s*([\s\S]*?)```/gi)];
  for (const match of blocks) {
    const code = match[1].trim();
    if (/implicit\.js\/0\.1\.0|export\s+default\s*\{[\s\S]*glsl/i.test(code)) {
      return code;
    }
  }
  if (/export\s+default\s*\{[\s\S]*schema:\s*["']implicit\.js/i.test(text)) {
    const m = text.match(/export\s+default\s*\{[\s\S]*\};?/);
    if (m) return m[0];
  }
  return null;
}

export function hasImplicitPayload(text = '') {
  return /implicit\.js\/0\.1\.0/i.test(text)
    || /implicit_[a-z_]+\(/i.test(text)
    || /signed[- ]distance|sdf\s*\(\s*vec3/i.test(text);
}

async function resolveImplicitModuleAsync({
  assistantText = '',
  userMessage = '',
  conversationContext = '',
  onProgress = () => {},
}) {
  const extracted = extractImplicitModule(assistantText);
  if (extracted) return extracted;

  const combined = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
  if (!detectFromScratchBuild(combined) && !/\[AGENT_PHASE:\s*execute\]/i.test(assistantText)) {
    return null;
  }

  onProgress('Generating full implicit.js module from design plan…');
  return generateImplicitCodeFromPlan({ userMessage, assistantText, conversationContext });
}

export async function executeImplicitGeneration({
  userId,
  projectId,
  userMessage = '',
  assistantText,
  conversationContext = '',
  modelName = 'implicit_model',
  exportFormats = ['glb', 'stl'],
  onProgress = () => {},
}) {
  const meta = skillMeta('implicit-cad');
  onProgress(`Skill: ${meta.label} (${meta.dir})`);

  const code = await resolveImplicitModuleAsync({
    assistantText,
    userMessage,
    conversationContext,
    onProgress,
  });
  if (!code) {
    return {
      ok: false,
      skill: 'implicit-cad',
      error: 'No implicit.js module in AI response. Ask for an implicit CAD model with export default { schema: "implicit.js/0.1.0", glsl: ... }',
    };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-implicit-'));
  const fileName = `${modelName}.implicit.js`;
  const filePath = path.join(workDir, fileName);

  try {
    await fs.writeFile(filePath, code.endsWith('\n') ? code : `${code}\n`, 'utf8');
    const key = buildS3Key(userId, projectId, `models/${fileName}`);
    const upload = await uploadFile(key, filePath, 'text/javascript');

    const fileStat = await fs.stat(filePath);
    const fileDoc = await upsertProjectFile({
      projectId,
      userId,
      name: fileName,
      s3Key: upload.key,
      mimeType: 'text/javascript',
      kind: 'implicit',
      sizeBytes: fileStat.size,
    });

    onProgress(`Saved ${fileName} — open in CAD Viewer (implicit raymarch)`);

    const exported = [];
    const base = modelName;
    for (const format of exportFormats) {
      const outName = `${base}.${format}`;
      const outPath = path.join(workDir, outName);
      try {
        onProgress(`Exporting implicit → ${format.toUpperCase()}…`);
        await exportImplicitFormat({ implicitPath: filePath, format, outputPath: outPath });
        const sidecar = await uploadSidecarIfExists({
          userId,
          projectId,
          workDir,
          fileName: outName,
          onProgress,
        });
        if (sidecar) exported.push(sidecar);
      } catch (exportErr) {
        console.warn(`[implicit] ${format} export:`, exportErr.message);
        onProgress(`${format.toUpperCase()} export skipped: ${exportErr.message}`);
      }
    }

    try {
      const { syncProjectWorkspace } = await import('./projectWorkspace.js');
      await syncProjectWorkspace({ userId, projectId });
    } catch (err) {
      console.warn('[implicit] workspace sync:', err.message);
    }

    return {
      ok: true,
      skill: 'implicit-cad',
      file: fileDoc,
      exported,
      url: upload.url,
      s3Key: upload.key,
    };
  } catch (err) {
    return { ok: false, skill: 'implicit-cad', error: err.message };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
