import { ChatMessage } from '../models/ChatMessage.js';
import { streamChatCompletion, normalizeAssistantReply } from './openrouter.js';
import { shouldDeferPipeline } from './agentBehavior.js';
import { runSkillPipeline, resolveSkillFromChat, normalizePipelineResult } from './skillOrchestrator.js';

const MAX_RECOVERY_ATTEMPTS = 1;

function pipelineFailed(result) {
  if (!result) return true;
  if (result.deferred) return false;
  if (result.hint === 'assembly_needs_parts' || result.hint === 'clarify') return false;
  return result.ok === false || Boolean(result.error);
}

function emit(res, payload) {
  if (res?.write) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

/**
 * Run skill pipeline; on failure optionally re-ask the model once and retry.
 */
export async function runPipelineWithRecovery({
  res,
  userId,
  projectId,
  project,
  userMessage,
  assistantText,
  conversationContext,
  focusedFiles,
  selectionContext = '',
  chatModel,
  systemPrompt,
  messages,
  maxTokens,
  webSearch,
  imageDataUrl,
  hasImage,
}) {
  const runOnce = async (text) => {
    const skill = resolveSkillFromChat(userMessage, text);
    if (shouldDeferPipeline({
      userMessage,
      assistantText: text,
      skill,
      history: messages,
      conversationContext,
      hasImage,
      focusedFileCount: focusedFiles.length + (selectionContext ? 1 : 0),
    })) {
      return {
        cadResult: { ok: true, skill: 'agent', deferred: true, hint: 'clarify' },
        pipelineDeferred: true,
        assistantText: text,
      };
    }

    emit(res, { type: 'agent_phase', phase: 'executing', message: 'Executing design pipeline…' });
    const pipeline = await runSkillPipeline({
      res,
      userId,
      projectId,
      userMessage,
      assistantText: text,
      project,
      conversationContext,
      focusedFiles,
      selectionContext,
    });
    const cadResult = normalizePipelineResult(pipeline.result);
    if (cadResult && pipeline.skill) cadResult.skill = cadResult.skill || pipeline.skill;
    const pipelineDeferred = Boolean(cadResult?.deferred && cadResult?.hint === 'assembly_needs_parts');
    return { cadResult, pipelineDeferred, assistantText: text };
  };

  let outcome = await runOnce(assistantText);
  if (!pipelineFailed(outcome.cadResult) || outcome.pipelineDeferred) {
    return outcome;
  }

  for (let attempt = 0; attempt < MAX_RECOVERY_ATTEMPTS; attempt += 1) {
    const errText = outcome.cadResult?.error || 'Pipeline did not produce files';
    emit(res, {
      type: 'agent_phase',
      phase: 'thinking',
      message: 'Adjusting design and retrying…',
    });
    emit(res, {
      type: 'cad_status',
      message: `Recovery: ${errText}`,
      skill: 'agent',
      status: 'running',
    });

    const recoveryMessages = [
      ...messages,
      { role: 'assistant', content: assistantText },
      {
        role: 'user',
        content: `The build failed: ${errText}\nFix the generator code and output a corrected full script with [AGENT_PHASE: execute]. Keep the same output basename unless the user asked to rename.`,
      },
    ];

    let recoveryText = '';
    for await (const chunk of streamChatCompletion(recoveryMessages, {
      model: chatModel,
      system: systemPrompt,
      maxTokens,
      webSearch,
      imageDataUrl,
    })) {
      recoveryText += chunk;
      emit(res, { type: 'delta', content: chunk });
    }

    await ChatMessage.create({
      projectId,
      userId,
      role: 'assistant',
      content: recoveryText,
    });

    assistantText = recoveryText;
    outcome = await runOnce(recoveryText);
    if (!pipelineFailed(outcome.cadResult) || outcome.pipelineDeferred) {
      outcome.assistantText = normalizeAssistantReply(recoveryText);
      return outcome;
    }
  }

  return outcome;
}
