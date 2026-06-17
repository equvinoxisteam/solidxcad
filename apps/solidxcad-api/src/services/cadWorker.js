import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';
import { extractPythonCode, repairPythonScript, generateCadCodeFromPlan } from './openrouter.js';
import { buildS3Key, uploadFile, getObjectStream } from './s3.js';
import { ProjectFile } from '../models/ProjectFile.js';
import {
  findPython,
  runCadStepFromScript,
  exportDxfFromScript,
  uploadSidecarIfExists,
} from './cadExportService.js';
import {
  detectHilbertRequest,
  parseHilbertParams,
  buildHilbertGenStep,
  detectAssemblyWithParts,
  wantsAssembly,
  parsePlateParams,
  buildAssemblyMountGenStep,
  injectCadHelpers,
  sanitizeInventedApis,
  sanitizeRotationUsage,
  sanitizeCompoundInCode,
  detectGearRequest,
  detectRoboticArmRequest,
  parseRoboticArmParams,
  buildRoboticArmGenStep,
  buildFallbackGenStep,
  buildGearFallbackGenStep,
  detectComplexCadRequest,
} from './cadPythonPresets.js';

function formatPythonError(raw) {
  if (!raw) return 'Python script failed';
  const lines = raw.trim().split('\n');
  const last = lines.filter((l) => l.includes('Error') || l.includes('Exception')).pop();
  if (last) return last.replace(/^[^:]+:\s*/, '').trim() || last;
  return lines.slice(-3).join(' ').slice(0, 300);
}

/** Fix common build123d API mistakes from LLM output before running Python. */
function sanitizeBuild123dCode(code, { preserveAssembly = false } = {}) {
  let out = sanitizeInventedApis(code);
  out = sanitizeRotationUsage(out);
  if (!preserveAssembly) {
    out = sanitizeCompoundInCode(out);
  }
  out = out.replace(/Hole\s*\(\s*diameter\s*=\s*([^,)]+)\s*\)/gi, 'Hole(radius=($1)/2)');
  out = out.replace(/Hole\s*\(\s*diameter\s*=\s*([^,)]+)\s*,/gi, 'Hole(radius=($1)/2,');
  out = out.replace(/,\s*diameter\s*=\s*([^,)]+)\s*\)/gi, ', radius=($1)/2)');
  out = out.replace(/,\s*diameter\s*=\s*([^,)]+)\s*,/gi, ', radius=($1)/2,');
  return out;
}

function localRepairPython(code, errorMessage) {
  const err = String(errorMessage || '').toLowerCase();
  if (err.includes('diameter') && err.includes('hole')) {
    return sanitizeBuild123dCode(code);
  }
  if (err.includes("unexpected keyword argument 'diameter'")) {
    return sanitizeBuild123dCode(code);
  }
  if (err.includes('children') && err.includes('must be an object')) {
    return sanitizeCompoundInCode(code);
  }
  if (err.includes('compound')) {
    return sanitizeCompoundInCode(code);
  }
  if (err.includes('invalid key for rotation') || err.includes('rotation')) {
    return sanitizeRotationUsage(code);
  }
  if (err.includes('hilbert3d') && err.includes('not defined')) {
    return injectCadHelpers(code);
  }
  if (err.includes('angle_degrees') && err.includes('not defined')) {
    return sanitizeInventedApis(code);
  }
  if (err.includes('_fuse_all') && err.includes('not defined')) {
    return injectCadHelpers(code);
  }
  if (err.includes('must return one value')) {
    return ensureSingleGenStepReturn(code);
  }
  return null;
}

function ensureSingleGenStepReturn(code) {
  if (!/def\s+gen_step\s*\(/i.test(code)) return code;
  if (/\breturn\s+Compound\s*\(/i.test(code)) return code;
  if (/\breturn\s+part\b/i.test(code)) return code;
  return `${code.trim()}\n`;
}

async function copyProjectPartsToWorkDir({ userId, projectId, workDir }) {
  const parts = await ProjectFile.find({
    projectId,
    userId,
    s3Key: /\/parts\//,
  }).sort({ createdAt: -1 });

  const copied = [];
  for (const part of parts) {
    const relPath = `parts/${part.name}`.replace(/\\/g, '/');
    const dest = path.join(workDir, relPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await pipeline(await getObjectStream(part.s3Key), createWriteStream(dest));
      copied.push({ name: part.name, relPath });
    } catch (err) {
      console.warn(`[cad] skip part copy ${part.name}:`, err.message);
    }
  }
  return copied;
}

function resolveCadPython({ userMessage = '', assistantText = '', conversationContext = '', partFiles = [] }) {
  const combined = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
  if (detectAssemblyWithParts(combined, partFiles.length)) {
    const plate = parsePlateParams(combined);
    const screw = partFiles[0];
    return {
      code: buildAssemblyMountGenStep({
        ...plate,
        screwRelPath: screw.relPath,
      }),
      source: 'preset-assembly',
      params: { ...plate, screw: screw.name },
    };
  }
  if (detectRoboticArmRequest(combined) && !/\bgen_urdf\s*\(/i.test(combined)) {
    const params = parseRoboticArmParams(combined);
    return {
      code: buildRoboticArmGenStep(params),
      source: 'preset-robotic-arm',
      params,
    };
  }
  if (detectHilbertRequest(combined)) {
    const params = parseHilbertParams(combined);
    return {
      code: buildHilbertGenStep(params),
      source: 'preset-hilbert',
      params,
    };
  }
  const extracted = extractCadPython(assistantText);
  if (!extracted) return null;
  return { code: extracted, source: 'llm' };
}

async function resolveCadPythonAsync({
  userMessage = '',
  assistantText = '',
  conversationContext = '',
  partFiles = [],
  onProgress = () => {},
}) {
  const resolved = resolveCadPython({ userMessage, assistantText, conversationContext, partFiles });
  if (resolved) return resolved;

  const combined = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
  if (!detectComplexCadRequest(combined) && !/\[AGENT_PHASE:\s*execute\]/i.test(assistantText)) {
    return null;
  }

  onProgress('Generating full build123d script from design plan…');
  const generated = await generateCadCodeFromPlan({
    userMessage,
    assistantText,
    conversationContext,
  });
  if (!generated) return null;
  return { code: generated, source: 'llm-plan' };
}

function sanitizeCompoundUsage(code) {
  return sanitizeCompoundInCode(code);
}

export function extractCadPython(text) {
  const fenced = extractPythonCode(text);
  if (fenced) return fenced;

  if (!/build123d|gen_step|export_step|Box\(|Cylinder\(|Sphere\(|extrude\(/i.test(text)) {
    return null;
  }

  const lines = text.split('\n').filter((line) => {
    const t = line.trim();
    if (!t) return false;
    if (/^(from |import |def |#|part |with |for |if |return |export_|\w+\s*=|@)/.test(t)) return true;
    if (/^\s{2,}/.test(line)) return true;
    return false;
  });

  const joined = lines.join('\n').trim();
  return joined.length >= 20 ? joined : null;
}

export function hasCadPayload(text = '', conversationContext = '') {
  const combined = [conversationContext, text].filter(Boolean).join('\n');
  return Boolean(extractCadPython(text))
    || detectHilbertRequest(combined)
    || detectRoboticArmRequest(combined)
    || detectComplexCadRequest(combined);
}

function prepareGenStepCode(pythonCode, { isPreset = false, preserveCompound = false, preserveAssembly = false } = {}) {
  let code = pythonCode.trim();
  const keepCompound = preserveCompound
    || preserveAssembly
    || (/Compound\s*\(/i.test(code) && /children\s*=\s*\[/i.test(code));
  if (isPreset && keepCompound) {
    code = sanitizeRotationUsage(sanitizeInventedApis(code));
  } else {
    code = sanitizeBuild123dCode(code, { preserveAssembly: keepCompound });
  }
  if (isPreset && /def\s+gen_step\s*\(/i.test(code)) return code;

  code = code.replace(/export_step\s*\([^)]*\)\s*/g, '');
  code = code.replace(/export_stl\s*\([^)]*\)\s*/g, '');
  code = code.replace(/\n# Auto export[\s\S]*$/m, '');

  if (!/from build123d import/i.test(code) && !/import build123d/i.test(code)) {
    code = `from build123d import *\n\n${code}`;
  }

  if (!isPreset) {
    code = injectCadHelpers(code);
  }

  if (/def\s+gen_step\s*\(/i.test(code)) return code;

  const lines = code.split('\n');
  const header = [];
  const body = [];
  for (const line of lines) {
    if (/^(from |import )/.test(line.trim())) header.push(line);
    else body.push(line);
  }

  const bodyStr = body.join('\n').trim();
  const indented = bodyStr.split('\n').map((l) => (l ? `    ${l}` : '')).join('\n');
  let footer = '';
  if (!/\breturn\b/.test(bodyStr)) {
    if (/\bpart\b/.test(bodyStr)) {
      footer = '\n    return part';
    } else {
      footer = `\n    for _n, _v in list(locals().items()):
        if _n.startswith('_'):
            continue
        if hasattr(_v, 'wrapped'):
            return _v
    raise RuntimeError('gen_step() must return a build123d shape')`;
    }
  }

  return `${header.join('\n')}\n\ndef gen_step():\n${indented}${footer}\n`;
}

async function findStepFile(workDir, stepPath) {
  try {
    await fs.access(stepPath);
    return stepPath;
  } catch {
    const files = await fs.readdir(workDir);
    const stepFile = files.find((f) => f.endsWith('.step') || f.endsWith('.stp'));
    if (stepFile) return path.join(workDir, stepFile);
  }
  return null;
}

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
    existing.sizeBytes = sizeBytes;
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

export async function regeneratePartFromPython({
  userId,
  projectId,
  partName,
  pythonCode,
  onProgress = () => {},
}) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-repair-'));
  const scriptName = `${partName}.py`;
  const stepName = `${partName}.step`;
  const scriptPath = path.join(workDir, scriptName);
  const stepPath = path.join(workDir, stepName);

  try {
    const preserveCompound = /Compound\s*\(/i.test(pythonCode);
    const finalCode = prepareGenStepCode(pythonCode, {
      preserveCompound,
      preserveAssembly: preserveCompound,
    });
    await fs.writeFile(scriptPath, finalCode, 'utf8');
    onProgress(`Regenerating ${stepName} from saved Python…`);

    await runCadStepFromScript({
      workDir,
      scriptName,
      stepName,
      sidecars: {
        stl: `${partName}.stl`,
        glb: `${partName}.glb`,
      },
    });

    const stepFile = await findStepFile(workDir, stepPath);
    if (!stepFile) {
      return { ok: false, error: `Could not regenerate ${stepName}` };
    }

    const stepStat = await fs.stat(stepFile);
    const stepUpload = await uploadFile(
      buildS3Key(userId, projectId, `models/${stepName}`),
      stepFile,
      'application/step',
    );
    const stepDoc = await upsertProjectFile({
      projectId,
      userId,
      name: stepName,
      s3Key: stepUpload.key,
      mimeType: 'application/step',
      kind: 'step',
      sizeBytes: stepStat.size,
    });

    const scriptStat = await fs.stat(scriptPath);
    const scriptUpload = await uploadFile(
      buildS3Key(userId, projectId, `models/${scriptName}`),
      scriptPath,
      'text/x-python',
    );
    await upsertProjectFile({
      projectId,
      userId,
      name: scriptName,
      s3Key: scriptUpload.key,
      mimeType: 'text/x-python',
      kind: 'other',
      sizeBytes: scriptStat.size,
    });

    await uploadSidecarIfExists({
      userId,
      projectId,
      workDir,
      fileName: `${partName}.stl`,
      onProgress,
    });
    await uploadSidecarIfExists({
      userId,
      projectId,
      workDir,
      fileName: `${partName}.glb`,
      onProgress,
    });

    try {
      const { ensureMeshSidecar, ensureGlbSidecar } = await import('./artifactPipeline.js');
      await ensureMeshSidecar({
        userId,
        projectId,
        stepFileDoc: stepDoc,
        stepLocalPath: stepFile,
      });
      await ensureGlbSidecar({
        userId,
        projectId,
        stepFileDoc: stepDoc,
        stepLocalPath: stepFile,
        onProgress,
      });
    } catch (sidecarErr) {
      console.warn('[repair] sidecar generation skipped:', sidecarErr.message);
    }

    onProgress(`Restored ${stepName} to cloud storage`);
    return { ok: true, stepDoc };
  } catch (err) {
    return { ok: false, error: err.message || 'Regeneration failed' };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function executeCadGeneration({
  userId,
  projectId,
  userMessage = '',
  assistantText,
  conversationContext = '',
  partName = 'model',
  exportOptions = {},
  onProgress = () => {},
}) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-'));
  const partFiles = await copyProjectPartsToWorkDir({ userId, projectId, workDir });
  const ctx = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
  const complexBuild = detectComplexCadRequest(ctx);
  const resolved = await resolveCadPythonAsync({
    userMessage,
    assistantText,
    conversationContext,
    partFiles,
    onProgress,
  });
  if (!resolved) {
    await fs.rm(workDir, { recursive: true, force: true });
    return {
      ok: false,
      error: complexBuild
        ? 'Design plan did not produce runnable CAD code. Try again or say "proceed with defaults" after the plan.'
        : 'No Python code in AI response. Ask again: "Create a simple box 20x30x10mm and export STEP"',
    };
  }

  let pythonCode = resolved.code;
  let codeSource = resolved.source;
  let isPreset = ['preset-hilbert', 'preset-assembly', 'preset-fallback', 'preset-robotic-arm']
    .includes(codeSource);
  let preserveCompound = codeSource === 'preset-assembly' || codeSource === 'preset-robotic-arm';
  const preserveAssembly = preserveCompound || wantsAssembly(userMessage) || wantsAssembly(ctx) || complexBuild;
  if (codeSource === 'preset-hilbert') {
    const { order, envelopeMm, barMm } = resolved.params;
    onProgress(`Using tested Hilbert preset (level ${order}, ${envelopeMm} mm cube, ${barMm} mm bars)…`);
  } else if (codeSource === 'preset-assembly') {
    const { length, width, thick, screw } = resolved.params;
    onProgress(`Using tested assembly preset (${length}×${width}×${thick} mm plate + ${screw})…`);
  } else if (codeSource === 'preset-robotic-arm') {
    const { reachMm } = resolved.params;
    onProgress(`Using tested 6-DOF robotic arm preset (~${reachMm} mm reach, flange bolts + gripper)…`);
  } else {
    onProgress('Extracting build123d Python from AI response…');
  }

  onProgress('Pipeline: skills/cad → gen_step() → STEP/STL/GLB');
  const scriptName = `${partName}.py`;
  const scriptPath = path.join(workDir, scriptName);
  const stepName = `${partName}.step`;
  const stepPath = path.join(workDir, stepName);
  const python = await findPython();

  const wants3mf = exportOptions.threeMf !== false && exportOptions.threeMf;
  const wantsDxf = exportOptions.dxf === true || /def\s+gen_dxf\s*\(/i.test(pythonCode);

  let lastError = null;
  const maxAttempts = complexBuild ? 8 : 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      onProgress(`Retrying script (attempt ${attempt + 1}/${maxAttempts})…`);
    } else {
      onProgress(`Running skills/cad/scripts/step via ${path.basename(python)}…`);
    }

    const finalCode = prepareGenStepCode(pythonCode, { isPreset, preserveCompound, preserveAssembly });
    await fs.writeFile(scriptPath, finalCode, 'utf8');

    try {
      await runCadStepFromScript({
        workDir,
        scriptName,
        stepName,
        sidecars: {
          stl: `${partName}.stl`,
          threeMf: wants3mf ? `${partName}.3mf` : null,
          glb: `${partName}.glb`,
        },
      });

      const stepFile = await findStepFile(workDir, stepPath);
      if (!stepFile) {
        lastError = 'STEP file was not created. Try a simpler shape (box, bracket, cylinder).';
        break;
      }

      onProgress('STEP geometry created — saving files…');

      const stepKey = buildS3Key(userId, projectId, `models/${stepName}`);
      const stepUpload = await uploadFile(stepKey, stepFile, 'application/step');
      onProgress(`Saved ${stepName}`);

      const fileDoc = await ProjectFile.create({
        projectId,
        userId,
        name: stepName,
        s3Key: stepUpload.key,
        mimeType: 'application/step',
        kind: 'step',
      });

      const scriptKey = buildS3Key(userId, projectId, `models/${scriptName}`);
      const scriptUpload = await uploadFile(scriptKey, scriptPath, 'text/x-python');
      await ProjectFile.create({
        projectId,
        userId,
        name: scriptName,
        s3Key: scriptUpload.key,
        mimeType: 'text/x-python',
        kind: 'other',
      });
      onProgress(`Saved ${scriptName} (generator sidecar)`);

      const stlDoc = await uploadSidecarIfExists({
        userId,
        projectId,
        workDir,
        fileName: `${partName}.stl`,
        onProgress,
      });

      const threeMfDoc = wants3mf
        ? await uploadSidecarIfExists({
          userId,
          projectId,
          workDir,
          fileName: `${partName}.3mf`,
          onProgress,
        })
        : null;

      const glbDoc = await uploadSidecarIfExists({
        userId,
        projectId,
        workDir,
        fileName: `${partName}.glb`,
        onProgress,
      });

      if (!stlDoc) {
        try {
          const { ensureMeshSidecar } = await import('./artifactPipeline.js');
          await ensureMeshSidecar({
            userId,
            projectId,
            stepFileDoc: fileDoc,
            stepLocalPath: stepFile,
          });
        } catch (stlErr) {
          console.warn('[cad] STL sidecar fallback failed:', stlErr.message);
        }
      }

      if (!glbDoc) {
        try {
          const { ensureGlbSidecar } = await import('./artifactPipeline.js');
          await ensureGlbSidecar({
            userId,
            projectId,
            stepFileDoc: fileDoc,
            stepLocalPath: stepFile,
            onProgress,
          });
        } catch (glbErr) {
          console.warn('[cad] GLB sidecar fallback failed:', glbErr.message);
        }
      }

      let dxfDoc = null;
      if (wantsDxf && /def\s+gen_dxf\s*\(/i.test(finalCode)) {
        try {
          onProgress('Exporting DXF (skills/cad/scripts/dxf)…');
          const dxfPath = await exportDxfFromScript({ workDir, scriptName });
          dxfDoc = await uploadSidecarIfExists({
            userId,
            projectId,
            workDir,
            fileName: path.basename(dxfPath),
            onProgress,
          });
        } catch (dxfErr) {
          console.warn('[cad] DXF export failed:', dxfErr.message);
          onProgress(`DXF export skipped: ${dxfErr.message}`);
        }
      }

      try {
        const { syncProjectWorkspace } = await import('./projectWorkspace.js');
        await syncProjectWorkspace({ userId, projectId });
      } catch (syncErr) {
        console.warn('[cad] workspace sync:', syncErr.message);
      }

      await fs.rm(workDir, { recursive: true, force: true });

      return {
        ok: true,
        skill: 'cad',
        file: fileDoc,
        stlFile: stlDoc,
        threeMfFile: threeMfDoc,
        glbFile: glbDoc,
        dxfFile: dxfDoc,
        url: stepUpload.url,
        s3Key: stepUpload.key,
        repaired: attempt > 0,
      };
    } catch (err) {
      lastError = formatPythonError(err.message);
      console.error(`[cad] attempt ${attempt + 1} failed:`, lastError);

      const localFix = localRepairPython(pythonCode, lastError);
      if (localFix && localFix !== pythonCode) {
        onProgress('Applying local API fix (e.g. Hole radius)…');
        pythonCode = localFix;
        continue;
      }

      const hilbertCtx = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
      if (detectAssemblyWithParts(hilbertCtx, partFiles.length) && codeSource !== 'preset-assembly') {
        onProgress('Falling back to tested assembly preset…');
        pythonCode = buildAssemblyMountGenStep({
          ...parsePlateParams(hilbertCtx),
          screwRelPath: partFiles[0].relPath,
        });
        codeSource = 'preset-assembly';
        isPreset = true;
        continue;
      }
      if (detectRoboticArmRequest(hilbertCtx) && codeSource !== 'preset-robotic-arm') {
        onProgress('Falling back to tested 6-DOF robotic arm preset…');
        pythonCode = buildRoboticArmGenStep(parseRoboticArmParams(hilbertCtx));
        codeSource = 'preset-robotic-arm';
        isPreset = true;
        preserveCompound = true;
        continue;
      }
      if (detectHilbertRequest(hilbertCtx) && codeSource !== 'preset-hilbert') {
        onProgress('Falling back to tested Hilbert preset…');
        pythonCode = buildHilbertGenStep(parseHilbertParams(hilbertCtx));
        codeSource = 'preset-hilbert';
        isPreset = true;
        continue;
      }
      if (detectGearRequest(hilbertCtx) && codeSource !== 'preset-fallback') {
        onProgress('Using tested gear fallback (cylinder + bore)…');
        pythonCode = buildGearFallbackGenStep(hilbertCtx);
        codeSource = 'preset-fallback';
        isPreset = true;
        continue;
      }

      if (attempt < maxAttempts - 1 && config.openrouter.apiKey && !isPreset) {
        try {
          onProgress('Asking AI to repair the script…');
          const fixed = await repairPythonScript(finalCode, lastError, { complex: complexBuild });
          if (fixed && fixed !== pythonCode) {
            pythonCode = injectCadHelpers(sanitizeInventedApis(fixed));
            continue;
          }
        } catch (repairErr) {
          console.error('[cad] auto-repair failed:', repairErr.message);
        }
      }
      break;
    }
  }

  if (complexBuild) {
    await fs.rm(workDir, { recursive: true, force: true });
    return {
      ok: false,
      error: lastError || 'Complex design could not be generated. Try a smaller sub-assembly first or say "proceed with defaults".',
      complexBuildFailed: true,
    };
  }

  onProgress('Using reliable solid fallback…');
  if (detectRoboticArmRequest(ctx)) {
    pythonCode = buildRoboticArmGenStep(parseRoboticArmParams(ctx));
    codeSource = 'preset-robotic-arm';
    preserveCompound = true;
  } else if (detectGearRequest(ctx)) {
    pythonCode = buildGearFallbackGenStep(ctx);
    codeSource = 'preset-fallback';
  } else {
    pythonCode = buildFallbackGenStep(ctx);
    codeSource = 'preset-fallback';
  }
  isPreset = true;

  try {
    const finalCode = prepareGenStepCode(pythonCode, {
      isPreset: true,
      preserveCompound: codeSource === 'preset-robotic-arm' || codeSource === 'preset-assembly',
    });
    await fs.writeFile(scriptPath, finalCode, 'utf8');
    await runCadStepFromScript({
      workDir,
      scriptName,
      stepName,
      sidecars: {
        stl: `${partName}.stl`,
        threeMf: wants3mf ? `${partName}.3mf` : null,
        glb: `${partName}.glb`,
      },
    });
    const stepFile = await findStepFile(workDir, stepPath);
    if (stepFile) {
      onProgress('Fallback solid created — saving files…');
      const stepKey = buildS3Key(userId, projectId, `models/${stepName}`);
      const stepUpload = await uploadFile(stepKey, stepFile, 'application/step');
      const fileDoc = await ProjectFile.create({
        projectId,
        userId,
        name: stepName,
        s3Key: stepUpload.key,
        mimeType: 'application/step',
        kind: 'step',
      });
      const scriptKey = buildS3Key(userId, projectId, `models/${scriptName}`);
      const scriptUpload = await uploadFile(scriptKey, scriptPath, 'text/x-python');
      await ProjectFile.create({
        projectId,
        userId,
        name: scriptName,
        s3Key: scriptUpload.key,
        mimeType: 'text/x-python',
        kind: 'other',
      });
      try {
        const { ensureMeshSidecar, ensureGlbSidecar } = await import('./artifactPipeline.js');
        await ensureMeshSidecar({ userId, projectId, stepFileDoc: fileDoc, stepLocalPath: stepFile });
        await ensureGlbSidecar({
          userId,
          projectId,
          stepFileDoc: fileDoc,
          stepLocalPath: stepFile,
          onProgress,
        });
      } catch (sidecarErr) {
        console.warn('[cad] fallback sidecar:', sidecarErr.message);
      }
      try {
        const { syncProjectWorkspace } = await import('./projectWorkspace.js');
        await syncProjectWorkspace({ userId, projectId });
      } catch (syncErr) {
        console.warn('[cad] workspace sync:', syncErr.message);
      }
      await fs.rm(workDir, { recursive: true, force: true });
      return {
        ok: true,
        skill: 'cad',
        file: fileDoc,
        url: stepUpload.url,
        s3Key: stepUpload.key,
        repaired: true,
        fallback: true,
      };
    }
  } catch (fallbackErr) {
    console.error('[cad] fallback failed:', fallbackErr.message);
    lastError = formatPythonError(fallbackErr.message);
  }

  await fs.rm(workDir, { recursive: true, force: true });

  return {
    ok: false,
    error: lastError || 'Could not generate CAD',
  };
}

export async function searchStepParts(query) {
  const url = `https://api.step.parts/v1/parts?q=${encodeURIComponent(query)}&pageSize=10`;
  const res = await fetch(url, { headers: { 'User-Agent': 'solidxcad-api/1.0' } });
  if (!res.ok) throw new Error(`step.parts search failed: ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data.items)) return { parts: data.items, ...data };
  if (Array.isArray(data.parts)) return data;
  if (Array.isArray(data.results)) return { parts: data.results, ...data };
  if (Array.isArray(data)) return { parts: data };
  return data;
}

const BROWSE_PART_QUERIES = [
  'M3 socket head cap screw',
  'M4 socket head cap screw',
  '608 bearing',
  'hex nut M6',
  'washer M6',
  'Arduino Uno',
];

export async function browseStepParts() {
  const seen = new Set();
  const parts = [];
  for (const query of BROWSE_PART_QUERIES) {
    try {
      const data = await searchStepParts(query);
      const list = data.parts || data.items || [];
      for (const item of list) {
        const key = String(item.id || item.name || item.title || '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        parts.push(item);
      }
    } catch {
      // skip failed catalog query
    }
  }
  return { parts };
}
