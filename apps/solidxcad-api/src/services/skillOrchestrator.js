import {
  detectSkillIntent,
  wantsSliceAfterCad,
  wantsStandaloneSlice,
  wantsAssembly,
  wantsSrdfAfterUrdf,
  wantsDxfExport,
  wants3mfExport,
  implicitExportFormats,
  skillMeta,
} from './skillRegistry.js';
import { executeCadGeneration, hasCadPayload } from './cadWorker.js';
import { detectHilbertRequest, detectRoboticArmRequest, detectComplexCadRequest, detectFromScratchBuild } from './cadPythonPresets.js';
import { executeGeneratorSkill, hasGeneratorPayload } from './generatorWorker.js';
import { executeImplicitGeneration, hasImplicitPayload } from './implicitWorker.js';
import { executeSendCutSendPreflight } from './sendcutsendWorker.js';
import { importPartFromChat, wantsPartsImport } from './partsChatService.js';
import { executeSliceJob } from './sliceService.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { CREDIT_COSTS, chargeCredits } from './credits.js';
import { ASSEMBLY_PARTS_HINT, assemblyNeedsCatalogParts, extractAgentPlan } from './agentBehavior.js';
import { groupProjectFiles, resolvePipelineOutputBase, wantsModifyExisting, loadLatestProjectUrdf } from './projectAgentContext.js';

function emit(res, message, skill, status = 'info') {
  if (res?.write) {
    res.write(`data: ${JSON.stringify({ type: 'cad_status', message, skill, status })}\n\n`);
  }
}

function countPipelineSteps(userMessage, assistantText, cadContext, hasCode) {
  let total = 1;
  const skill = detectSkillIntent(userMessage, assistantText);
  if (wantsPartsImport(userMessage)) total += 1;
  const wantsCad = hasCadPayload(assistantText, cadContext)
    || detectHilbertRequest(cadContext)
    || detectRoboticArmRequest(cadContext)
    || detectComplexCadRequest(cadContext)
    || (hasCode && /build123d|export_step|Box\(|Cylinder\(/i.test(assistantText));
  if (wantsCad) total += 1;
  if (wantsSliceAfterCad(userMessage) && wantsCad) total += 1;
  if (skill === 'gcode' && wantsStandaloneSlice(userMessage)) total += 1;
  return total;
}

function createStepEmitter(res, total) {
  let step = 0;
  return (message, skill, status = 'info') => {
    const isMajor = status === 'running' || (status === 'done' && skill !== 'cad-viewer');
    const label = isMajor && status === 'running' ? `[Step ${++step}/${total}] ${message}` : message;
    emit(res, label, skill, status);
  };
}

export function resolveSkillFromChat(userMessage, assistantText) {
  return detectSkillIntent(userMessage, assistantText);
}

function filePayload(file) {
  if (!file) return undefined;
  const doc = file.toObject ? file.toObject() : file;
  return {
    _id: String(doc._id),
    name: doc.name,
    kind: doc.kind,
    s3Key: doc.s3Key,
  };
}

export function normalizePipelineResult(result) {
  if (!result) return null;
  const out = {
    ok: Boolean(result.ok),
    skill: result.skill,
    error: result.error,
    repaired: result.repaired,
    deferred: result.deferred,
    hint: result.hint,
    hintMessage: result.hintMessage,
  };
  const mainFile = result.file || result.sliceResult?.file;
  if (mainFile) out.file = filePayload(mainFile);
  if (result.sliceResult?.file) {
    out.sliceFile = filePayload(result.sliceResult.file);
    out.skill = out.skill || 'gcode';
  }
  if (result.stlFile) out.stlFile = filePayload(result.stlFile);
  return out;
}

async function runSlice({ res, userId, projectId, fileId, label = 'mesh' }) {
  emit(res, `Slicing ${label} (skills/gcode)…`, 'gcode', 'running');
  try {
    await chargeCredits(userId, CREDIT_COSTS.slice, 'slice', { projectId });
    const sliceResult = await executeSliceJob({
      userId: userId.toString(),
      projectId: projectId.toString(),
      fileId: fileId.toString(),
    });
    if (sliceResult.ok) {
      emit(res, `✓ G-code saved: slices/${sliceResult.file.name}`, 'gcode', 'done');
      for (const bundle of sliceResult.bundleFiles || []) {
        emit(res, `✓ Print mesh bundled: slices/${bundle.name}`, 'gcode', 'done');
      }
      return sliceResult;
    }
    emit(res, `✗ Slice failed: ${sliceResult.error}`, 'gcode', 'error');
    return sliceResult;
  } catch (err) {
    emit(res, `✗ Slice: ${err.message}`, 'gcode', 'error');
    return { ok: false, error: err.message };
  }
}

async function findSliceableFile(projectId, userId) {
  const files = await ProjectFile.find({
    projectId,
    userId,
    $or: [{ kind: 'stl' }, { kind: 'step' }, { name: /\.(stl|step|stp)$/i }],
  }).sort({ createdAt: -1 }).limit(1);
  return files[0] || null;
}

export async function runSkillPipeline({
  res,
  userId,
  projectId,
  userMessage,
  assistantText,
  project,
  conversationContext = '',
  focusedFiles = [],
}) {
  const skill = resolveSkillFromChat(userMessage, assistantText);
  const cadContext = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
  const hasCode = assistantText.includes('```');
  const totalSteps = countPipelineSteps(userMessage, assistantText, cadContext, hasCode);
  const stepEmit = createStepEmitter(res, totalSteps);
  const meta = skillMeta(skill);
  const plan = extractAgentPlan(assistantText);
  const modifyIntent = wantsModifyExisting(userMessage) || focusedFiles.length > 0;
  if (plan.length) {
    emit(res, 'Plan', 'agent', 'planning');
    for (const item of plan) {
      emit(res, `• ${item}`, 'agent', 'planning');
    }
  }

  const projectFiles = await ProjectFile.find({ projectId, userId }).sort({ createdAt: 1 });
  const grouped = groupProjectFiles(projectFiles);
  const fileSummary = ['models', 'assemblies', 'parts', 'slices']
    .filter((k) => grouped[k]?.length)
    .map((k) => `${k}/ (${grouped[k].length})`)
    .join(', ');
  if (fileSummary) {
    emit(res, `Exploring workspace — ${fileSummary}`, 'agent', 'exploring');
  }

  emit(res, `Executing pipeline (${totalSteps} steps) — ${meta.label}`, 'agent', 'running');

  let result = null;
  let partsResult = null;
  let cadResult = null;
  const isAssemblyBuild = wantsAssembly(userMessage);
  const outputBase = resolvePipelineOutputBase({
    userMessage,
    focusedFiles,
    skill,
    isAssembly: isAssemblyBuild,
    modifyIntent,
  });
  const cadStorageFolder = isAssemblyBuild ? 'assemblies' : 'models';
  const urdfContext = await loadLatestProjectUrdf(projectFiles);

  // Pre-step: import catalog parts when requested
  if (wantsPartsImport(userMessage)) {
    stepEmit('step.parts — search catalog and import STEP', 'step-parts', 'running');
    try {
      await chargeCredits(userId, CREDIT_COSTS.parts_download, 'parts_download', { projectId });
      const partResult = await importPartFromChat({
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        onProgress: (msg) => emit(res, msg, 'step-parts', 'info'),
      });
      if (partResult.ok) {
        partsResult = partResult;
        result = partResult;
        stepEmit('✓ Catalog part imported to workspace', 'step-parts', 'done');
      } else {
        stepEmit(`✗ ${partResult.error}`, 'step-parts', 'error');
      }
    } catch (err) {
      emit(res, `✗ Parts import: ${err.message}`, 'step-parts', 'error');
    }
  }

  if (skill === 'sendcutsend') {
    try {
      result = await executeSendCutSendPreflight({
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        onProgress: (msg) => emit(res, msg, 'sendcutsend'),
      });
    } catch (err) {
      result = { ok: false, skill: 'sendcutsend', error: err.message };
    }
  } else if (skill === 'gcode' && wantsStandaloneSlice(userMessage)) {
    stepEmit('G-code — slice latest mesh with OrcaSlicer', 'gcode', 'running');
    const mesh = await findSliceableFile(projectId, userId);
    if (mesh) {
      const sliceResult = await runSlice({
        res, userId, projectId, fileId: mesh._id, label: mesh.name,
      });
      result = {
        ok: sliceResult.ok,
        skill: 'gcode',
        file: sliceResult.file,
        sliceResult,
        error: sliceResult.error,
      };
      if (sliceResult.ok) {
        stepEmit('✓ G-code saved to workspace', 'gcode', 'done');
      }
    } else {
      emit(res, 'No STL/STEP in project — generate a part first', 'gcode', 'error');
      result = { ok: false, skill: 'gcode', error: 'No mesh to slice' };
    }
  } else if (skill === 'implicit-cad' && (hasCode || hasImplicitPayload(assistantText) || detectFromScratchBuild(cadContext))) {
    try {
      await chargeCredits(userId, CREDIT_COSTS.cad_generate, 'implicit_generate', { projectId });
      result = await executeImplicitGeneration({
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        assistantText,
        conversationContext: cadContext,
        modelName: outputBase,
        exportFormats: implicitExportFormats(userMessage),
        onProgress: (msg) => emit(res, msg, 'implicit-cad'),
      });
    } catch (err) {
      result = { ok: false, skill: 'implicit-cad', error: err.message };
    }
  } else if (skill === 'srdf' && (hasCode || hasGeneratorPayload(assistantText, 'srdf') || detectFromScratchBuild(cadContext))) {
    try {
      await chargeCredits(userId, CREDIT_COSTS.cad_generate, 'srdf_generate', { projectId });
      result = await executeGeneratorSkill({
        skillId: 'srdf',
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        assistantText,
        conversationContext: cadContext,
        urdfContext,
        outputBaseName: outputBase,
        onProgress: (msg) => emit(res, msg, 'srdf'),
      });
    } catch (err) {
      result = { ok: false, skill: 'srdf', error: err.message };
    }
  } else if (skill === 'sdf' && (hasCode || hasGeneratorPayload(assistantText, 'sdf') || detectFromScratchBuild(cadContext))) {
    try {
      await chargeCredits(userId, CREDIT_COSTS.cad_generate, 'sdf_generate', { projectId });
      result = await executeGeneratorSkill({
        skillId: 'sdf',
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        assistantText,
        conversationContext: cadContext,
        outputBaseName: outputBase,
        onProgress: (msg) => emit(res, msg, 'sdf'),
      });
    } catch (err) {
      result = { ok: false, skill: 'sdf', error: err.message };
    }
  } else if (skill === 'urdf' && (hasCode || hasGeneratorPayload(assistantText, 'urdf') || detectFromScratchBuild(cadContext))) {
    try {
      await chargeCredits(userId, CREDIT_COSTS.cad_generate, 'urdf_generate', { projectId });
      result = await executeGeneratorSkill({
        skillId: 'urdf',
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        assistantText,
        conversationContext: cadContext,
        outputBaseName: outputBase,
        onProgress: (msg) => emit(res, msg, 'urdf'),
      });
    } catch (err) {
      result = { ok: false, skill: 'urdf', error: err.message };
    }
  } else if (skill === 'step-parts' && !result?.ok) {
    emit(res, 'Try: "import M3 socket head screw from step.parts"', 'step-parts');
    result = { ok: true, skill: 'step-parts', hint: 'parts_tab' };
  } else if (skill === 'cad' || (hasCadPayload(assistantText, cadContext) && !assistantText.includes('gen_urdf') && !assistantText.includes('gen_srdf'))) {
    const wantsCad = hasCadPayload(assistantText, cadContext)
      || detectHilbertRequest(cadContext)
      || detectRoboticArmRequest(cadContext)
      || detectComplexCadRequest(cadContext)
      || (hasCode && /build123d|export_step|Box\(|Cylinder\(/i.test(assistantText));
    const partsAvailable = grouped.parts.length + (partsResult?.ok ? 1 : 0);
    const needsAssemblyParts = assemblyNeedsCatalogParts({
      userMessage,
      assistantText,
      partsCount: partsAvailable,
      importingParts: wantsPartsImport(userMessage),
    });

    if (needsAssemblyParts) {
      stepEmit('Assembly tree — import a catalog part into parts/ first', 'cad', 'asking');
      for (const line of ASSEMBLY_PARTS_HINT.split('\n').filter((l) => l.trim())) {
        emit(res, line.trim(), 'agent', 'info');
      }
      result = {
        ok: true,
        skill: 'cad',
        hint: 'assembly_needs_parts',
        hintMessage: ASSEMBLY_PARTS_HINT,
        deferred: true,
      };
    } else if (wantsCad) {
      try {
        await chargeCredits(userId, CREDIT_COSTS.cad_generate, 'cad_generate', { projectId });
        if (wantsAssembly(userMessage) || partsResult?.ok) {
          stepEmit('CAD assembly — gen_step() Compound + parts/ imports', 'cad', 'running');
        } else {
          stepEmit('CAD — gen_step() → STEP/STL/GLB', 'cad', 'running');
        }
        cadResult = await executeCadGeneration({
          userId: userId.toString(),
          projectId: projectId.toString(),
          userMessage,
          assistantText,
          conversationContext: cadContext,
          partName: outputBase,
          storageFolder: cadStorageFolder,
          exportOptions: {
            dxf: wantsDxfExport(userMessage),
            threeMf: wants3mfExport(userMessage) || wantsSliceAfterCad(userMessage),
          },
          onProgress: (msg) => emit(res, msg, 'cad', 'info'),
        });
        result = cadResult;
        if (cadResult?.ok) {
          const note = cadResult.fallback ? ' (reliable fallback solid)' : '';
          stepEmit(`✓ Solid model saved to workspace${note}`, 'cad', 'done');
        } else if (cadResult?.complexBuildFailed) {
          stepEmit(`✗ ${cadResult.error}`, 'cad', 'error');
        } else if (cadResult?.error) {
          stepEmit('Adjusting design — using tested fallback…', 'cad', 'running');
        }
        if (project) {
          project.lastPrompt = userMessage;
          await project.save();
        }
      } catch (err) {
        cadResult = { ok: false, skill: 'cad', error: err.message };
        result = cadResult;
        stepEmit(`✗ ${err.message}`, 'cad', 'error');
      }
    }
  }

  // Post: slice after CAD
  if (wantsSliceAfterCad(userMessage) && cadResult?.ok) {
    stepEmit('G-code — slice mesh with OrcaSlicer', 'gcode', 'running');
    const mesh = cadResult.stlFile || cadResult.file;
    const fileId = mesh?._id || (await findSliceableFile(projectId, userId))?._id;
    if (fileId) {
      const sliceResult = await runSlice({
        res,
        userId,
        projectId,
        fileId,
        label: mesh?.name || 'mesh',
      });
      if (sliceResult?.ok) {
        cadResult = { ...cadResult, sliceResult, skill: 'cad' };
        result = cadResult;
        stepEmit('✓ G-code saved to workspace', 'gcode', 'done');
      } else if (sliceResult?.error) {
        stepEmit(`✗ Slice failed: ${sliceResult.error}`, 'gcode', 'error');
      }
    } else {
      stepEmit('No STL mesh to slice', 'gcode', 'error');
    }
  }

  // Post: SRDF after URDF when both requested
  if (wantsSrdfAfterUrdf(userMessage) && result?.ok && result.skill === 'urdf' && hasGeneratorPayload(assistantText, 'srdf')) {
    emit(res, 'Generating SRDF for MoveIt…', 'srdf', 'running');
    try {
      await chargeCredits(userId, CREDIT_COSTS.cad_generate, 'srdf_generate', { projectId });
      const srdfResult = await executeGeneratorSkill({
        skillId: 'srdf',
        userId: userId.toString(),
        projectId: projectId.toString(),
        userMessage,
        assistantText,
        conversationContext: cadContext,
        urdfContext,
        outputBaseName: outputBase,
        onProgress: (msg) => emit(res, msg, 'srdf'),
      });
      if (srdfResult.ok) result = { ...result, srdfResult };
    } catch (err) {
      emit(res, `✗ SRDF: ${err.message}`, 'srdf', 'error');
    }
  }

  stepEmit('Sync CAD Viewer workspace (models/, assemblies/, parts/, slices/)', 'cad-viewer', 'running');
  try {
    const { syncProjectWorkspace } = await import('./projectWorkspace.js');
    await syncProjectWorkspace({ userId: userId.toString(), projectId: projectId.toString() });
    stepEmit('✓ Workspace synced — open CAD Viewer', 'cad-viewer', 'done');
  } catch (syncErr) {
    stepEmit(`✗ Workspace sync: ${syncErr.message}`, 'cad-viewer', 'error');
  }

  const primarySkill = cadResult?.ok ? 'cad' : partsResult?.ok ? 'step-parts' : skill;
  const summary = [];
  if (partsResult?.ok) summary.push(`parts/${partsResult.file?.name || 'part'}`);
  if (cadResult?.ok) {
    const folder = String(cadResult.file?.s3Key || '').includes('/assemblies/')
      ? 'assemblies'
      : 'models';
    summary.push(`${folder}/${cadResult.file?.name || 'part.step'}`);
  }
  if (cadResult?.sliceResult?.ok) summary.push(`slices/${cadResult.sliceResult.file?.name || 'part.gcode'}`);

  if (result?.ok || cadResult?.ok || partsResult?.ok) {
    emit(
      res,
      summary.length
        ? `✓ Pipeline complete — ${summary.join(', ')}`
        : '✓ Pipeline complete — open CAD Viewer',
      primarySkill,
      'done',
    );
  } else if (result?.error || cadResult?.error) {
    emit(res, 'Pipeline finished — try "30mm cube" for a quick solid part', primarySkill, 'info');
  } else if (!hasCode && !hasCadPayload(assistantText, cadContext) && !['gcode', 'sendcutsend', 'step-parts'].includes(skill)) {
    emit(res, 'No executable code in response — try a clearer prompt', skill, 'error');
  }

  const rawResult = cadResult || partsResult || result;
  return {
    skill: primarySkill,
    result: normalizePipelineResult(rawResult),
    partsResult,
    cadResult,
  };
}
