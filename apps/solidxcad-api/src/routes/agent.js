import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Project } from '../models/Project.js';
import { Job } from '../models/Job.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { chargeCredits, CREDIT_COSTS } from '../services/credits.js';
import { usageCost } from '../services/usage.js';
import {
  chatCompletion,
  streamChatCompletion,
  getSystemPromptForSkill,
  maxTokensForSkill,
} from '../services/openrouter.js';
import { buildGenerationSummary, buildNextSuggestions } from '../services/agentReply.js';
import { userFacingError, USER_ERRORS } from '../services/userFacingErrors.js';
import { shouldDeferPipeline } from '../services/agentBehavior.js';
import { searchStepParts } from '../services/cadWorker.js';
import { resolveChatModel, getChatModels } from '../services/models.js';
import { modelLabel, inferWebSearchNeeded } from '../services/modelPicker.js';
import { retrieveKnowledgeContext } from '../services/knowledgeRetrieval.js';
import { buildFocusedFileContext } from '../services/projectAgentContext.js';
import { runPipelineWithRecovery } from '../services/agentPipelineRecovery.js';
import { resolveSkillFromChat, normalizePipelineResult } from '../services/skillOrchestrator.js';
import { SKILLS, BROWSER_SKILLS } from '../services/skillRegistry.js';
import { ProjectFile } from '../models/ProjectFile.js';

function buildUserContextPrompt(user) {
  if (!user) return '';
  const parts = ['\n\n## User profile'];
  if (user.name) parts.push(`Name: ${user.name}`);
  if (user.phone) parts.push(`Phone: ${user.phone}`);
  if (user.onboarding?.useCase) parts.push(`Use case: ${user.onboarding.useCase}`);
  if (user.avatarUrl) parts.push('User has a profile photo on file — reference for personalization only.');
  return parts.join('\n');
}

function buildConversationContext(history, userMessage = '') {
  const userLines = history
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .slice(-6);
  if (userMessage && !userLines.includes(userMessage)) {
    userLines.push(userMessage);
  }
  return userLines.join('\n');
}

const router = Router();

router.get('/models', requireAuth, (req, res) => {
  res.json(getChatModels());
});

router.get('/skills', requireAuth, (req, res) => {
  res.json({
    skills: Object.values(SKILLS).map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      browser: BROWSER_SKILLS.includes(s.id),
    })),
  });
});

router.use(requireAuth);

router.post('/chat', async (req, res) => {
  const {
    projectId,
    message,
    stream = false,
    generateCad = true,
    model: requestedModel,
    modelMode = 'manual',
    webSearch: _webSearchIgnored = false,
    contextFileIds = [],
    imageDataUrl = '',
    selectionContext = '',
    viewerFileId = '',
  } = req.body;
  const trimmedMessage = message?.trim();
  if (!projectId || !trimmedMessage) {
    return res.status(400).json({ error: 'projectId and message required' });
  }

  const project = await Project.findOne({ _id: projectId, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const projectFiles = await ProjectFile.find({ projectId, userId: req.user._id }).sort({ createdAt: 1 });
  const skillIntent = resolveSkillFromChat(trimmedMessage, '');
  const focusedFiles = contextFileIds?.length
    ? projectFiles.filter((f) => contextFileIds.map(String).includes(String(f._id)))
    : [];
  const viewerFile = viewerFileId
    ? projectFiles.find((f) => String(f._id) === String(viewerFileId))
    : null;
  const contextIds = new Set(focusedFiles.map((f) => String(f._id)));
  if (viewerFile && !contextIds.has(String(viewerFile._id))) {
    focusedFiles.push(viewerFile);
  }
  const hasImage = Boolean(imageDataUrl && String(imageDataUrl).startsWith('data:image/'));
  const effectiveWebSearch = inferWebSearchNeeded(trimmedMessage, { hasImage, skill: skillIntent });
  const chatModel = resolveChatModel();

  try {
    await chargeCredits(req.user._id, CREDIT_COSTS.chat, 'chat', { projectId });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        balance: err.balance,
        message: 'You are out of design credits. Add credits in Settings or upgrade to Pro to continue.',
      });
    }
    throw err;
  }

  await ChatMessage.create({
    projectId,
    userId: req.user._id,
    role: 'user',
    content: trimmedMessage,
    creditsUsed: usageCost(CREDIT_COSTS.chat),
  });

  const history = await ChatMessage.find({ projectId }).sort({ createdAt: 1 }).limit(30);
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let systemPrompt = await getSystemPromptForSkill(skillIntent, { projectFiles, hasImage });
  systemPrompt += buildUserContextPrompt(req.user);
  const knowledgeContext = await retrieveKnowledgeContext(trimmedMessage, { skill: skillIntent });
  if (knowledgeContext) systemPrompt += knowledgeContext;
  const fileFocus = await buildFocusedFileContext(projectFiles, [
    ...new Set([...contextFileIds.map(String), viewerFile?._id].filter(Boolean)),
  ]);
  if (fileFocus) systemPrompt += fileFocus;
  if (selectionContext) {
    systemPrompt += `\n\n---\n## Viewer selection context\n${String(selectionContext).trim()}\nTreat this as the user's current focus in the 3D workbench. Edit the active STEP design and apply changes to the selected face/part/edge. Use CAD refs when present.`;
  }
  if (viewerFile && !selectionContext) {
    systemPrompt += `\n\n---\nThe user is viewing **${viewerFile.name}** in the workbench — prefer modifying that design unless they ask for something new.`;
  }
  if (effectiveWebSearch) {
    systemPrompt += '\n\n---\nWeb grounding is active for this turn when needed. Use current web results for standards, dimensions, materials, and product data.';
  }
  if (hasImage) {
    systemPrompt += `\n\n---\n## Reference image (all skills)
The user attached an image. Analyze it for shape, proportions, interfaces, and likely manufacturing intent.
- **CAD:** build123d gen_step() from visual geometry; estimate mm dimensions
- **URDF/SRDF/SDF:** infer linkage, joint axes, and simulation masses from the mechanism shown
- **Implicit:** match overall envelope with SDF raymarch when organic/lattice
- **Parts:** identify catalog fasteners if visible (bolts, bearings)
- **G-code:** if the image is a printed part, generate mesh then offer slicing
Decompose complex systems (rocket engines, robots, machines) into subassemblies in [AGENT_PLAN], then execute with [AGENT_PHASE: execute] when estimates are reasonable.`;
  }
  const maxTokens = maxTokensForSkill(skillIntent, { userMessage: trimmedMessage });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let clientOpen = true;
    req.on('close', () => { clientOpen = false; });

    const sseWrite = (payload) => {
      if (!clientOpen) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        clientOpen = false;
      }
    };

    const pipelineRes = {
      write: (chunk) => {
        if (!clientOpen) return;
        if (typeof chunk === 'string') {
          try {
            res.write(chunk);
          } catch {
            clientOpen = false;
          }
        }
      },
    };

    let full = '';
    let heartbeat = null;
    let agentJob = null;
    try {
      agentJob = await Job.create({
        userId: req.user._id,
        projectId,
        type: 'chat',
        status: 'running',
        startedAt: new Date(),
        input: { message: trimmedMessage.slice(0, 240) },
      });

      if (effectiveWebSearch) {
        sseWrite({
          type: 'agent_phase',
          phase: 'searching',
          message: 'Searching references and standards…',
        });
      }
      if (focusedFiles.length) {
        sseWrite({ type: 'agent_phase', phase: 'exploring', message: `Reviewing ${focusedFiles.map((f) => f.name).join(', ')}…` });
      }
      sseWrite({
        type: 'agent_phase',
        phase: 'reading',
        message: `Reading workspace · ${modelLabel(chatModel)}`,
      });
      sseWrite({ type: 'agent_phase', phase: 'thinking', message: 'Designing your solution…' });

      heartbeat = setInterval(() => {
        sseWrite({ type: 'ping' });
      }, 12000);

      for await (const chunk of streamChatCompletion(messages, {
        model: chatModel,
        system: systemPrompt,
        maxTokens,
        webSearch: effectiveWebSearch,
        imageDataUrl: hasImage ? imageDataUrl : undefined,
      })) {
        full += chunk;
        sseWrite({ type: 'delta', content: chunk });
      }

      const assistantMsg = await ChatMessage.create({
        projectId,
        userId: req.user._id,
        role: 'assistant',
        content: full,
      });

      let cadResult = null;
      let pipelineDeferred = false;
      const resolvedSkill = resolveSkillFromChat(trimmedMessage, full);
      if (generateCad) {
        const historyForAgent = messages.map((m) => ({ role: m.role, content: m.content }));
        const conversationContext = buildConversationContext(historyForAgent, trimmedMessage);
        if (shouldDeferPipeline({
          userMessage: trimmedMessage,
          assistantText: full,
          skill: resolvedSkill,
          history: historyForAgent,
          conversationContext,
          hasImage,
          focusedFileCount: focusedFiles.length + (selectionContext ? 1 : 0),
        })) {
          pipelineDeferred = true;
          sseWrite({
            type: 'agent_phase',
            phase: 'waiting',
            message: 'Waiting for your answers…',
          });
          sseWrite({
            type: 'cad_status',
            message: 'Asking clarifying questions — reply in chat to continue',
            skill: 'agent',
            status: 'asking',
          });
          cadResult = { ok: true, skill: 'agent', deferred: true, hint: 'clarify' };
        } else {
          const pipelineOutcome = await runPipelineWithRecovery({
            res: pipelineRes,
            userId: req.user._id,
            projectId: project._id,
            project,
            userMessage: trimmedMessage,
            assistantText: full,
            conversationContext,
            focusedFiles,
            selectionContext,
            chatModel,
            systemPrompt,
            messages,
            maxTokens,
            webSearch: effectiveWebSearch,
            imageDataUrl: hasImage ? imageDataUrl : undefined,
            hasImage,
          });
          cadResult = pipelineOutcome.cadResult;
          pipelineDeferred = pipelineOutcome.pipelineDeferred;
          if (pipelineOutcome.assistantText && pipelineOutcome.assistantText !== full) {
            full = pipelineOutcome.assistantText;
          }
        }
      }

      const userFacingReply = buildGenerationSummary(cadResult, { reply: full });
      const suggestions = buildNextSuggestions(cadResult, {
        pipelineDeferred,
        skill: resolvedSkill,
      });
      await ChatMessage.findByIdAndUpdate(assistantMsg._id, { content: userFacingReply });

      if (agentJob) {
        agentJob.status = cadResult && !cadResult.ok && !pipelineDeferred ? 'failed' : 'completed';
        agentJob.output = { cadResult, pipelineDeferred, skill: resolvedSkill };
        agentJob.completedAt = new Date();
        if (cadResult?.error) agentJob.error = cadResult.error;
        await agentJob.save();
      }

      if (heartbeat) clearInterval(heartbeat);
      sseWrite({
        type: 'done',
        messageId: assistantMsg._id,
        cadResult,
        skill: resolvedSkill,
        pipelineDeferred,
        reply: userFacingReply,
        suggestions,
        modelUsed: chatModel,
        webSearchUsed: effectiveWebSearch,
      });
      if (clientOpen) res.end();
    } catch (err) {
      if (heartbeat) clearInterval(heartbeat);
      if (agentJob) {
        agentJob.status = 'failed';
        agentJob.error = userFacingError(err?.message, 'chat');
        agentJob.completedAt = new Date();
        await agentJob.save().catch(() => {});
      }
      console.error('[agent/chat stream]', err);
      sseWrite({
        type: 'error',
        error: userFacingError(err?.message, 'chat'),
      });
      if (clientOpen) res.end();
    }
    return;
  }

  try {
    let reply = await chatCompletion(messages, {
      model: chatModel,
      system: systemPrompt,
      maxTokens,
      webSearch: effectiveWebSearch,
      imageDataUrl: hasImage ? imageDataUrl : undefined,
    });
    const assistantMsg = await ChatMessage.create({
      projectId,
      userId: req.user._id,
      role: 'assistant',
      content: reply,
    });

    let cadResult = null;
    let skill = resolveSkillFromChat(trimmedMessage, reply);
    let pipelineDeferred = false;
    if (generateCad) {
      const historyForAgent = messages.map((m) => ({ role: m.role, content: m.content }));
      const conversationContext = buildConversationContext(historyForAgent, trimmedMessage);
      if (shouldDeferPipeline({
        userMessage: trimmedMessage,
        assistantText: reply,
        skill,
        history: historyForAgent,
        conversationContext,
        hasImage,
        focusedFileCount: focusedFiles.length + (selectionContext ? 1 : 0),
      })) {
        pipelineDeferred = true;
        cadResult = { ok: true, skill: 'agent', deferred: true, hint: 'clarify' };
      } else {
        const pipelineOutcome = await runPipelineWithRecovery({
          res: null,
          userId: req.user._id,
          projectId: project._id,
          project,
          userMessage: trimmedMessage,
          assistantText: reply,
          conversationContext,
          focusedFiles,
          selectionContext,
          chatModel,
          systemPrompt,
          messages,
          maxTokens,
          webSearch: effectiveWebSearch,
          imageDataUrl: hasImage ? imageDataUrl : undefined,
          hasImage,
        });
        cadResult = pipelineOutcome.cadResult;
        pipelineDeferred = pipelineOutcome.pipelineDeferred;
        if (pipelineOutcome.assistantText && pipelineOutcome.assistantText !== reply) {
          reply = pipelineOutcome.assistantText;
          await ChatMessage.findByIdAndUpdate(assistantMsg._id, { content: reply });
        }
        skill = resolveSkillFromChat(trimmedMessage, reply);
        if (cadResult?.deferred && cadResult?.hint === 'assembly_needs_parts') {
          pipelineDeferred = true;
        }
      }
    }

    const userFacingReply = buildGenerationSummary(cadResult, { reply });
    const suggestions = buildNextSuggestions(cadResult, { pipelineDeferred, skill });
    await ChatMessage.findByIdAndUpdate(assistantMsg._id, { content: userFacingReply });

    res.json({
      reply: userFacingReply,
      messageId: assistantMsg._id,
      cadResult,
      skill,
      pipelineDeferred,
      suggestions,
      modelUsed: chatModel,
      webSearchUsed: effectiveWebSearch,
    });
  } catch (err) {
    console.error('[agent/chat]', err);
    res.status(500).json({ error: userFacingError(err?.message, 'chat') });
  }
});

router.post('/parts/search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  try {
    await chargeCredits(req.user._id, CREDIT_COSTS.parts_search, 'parts_search');
    const results = await searchStepParts(query.trim());
    res.json(results);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        balance: err.balance,
        message: 'You are out of design credits. Add credits in Settings or upgrade to Pro to continue.',
      });
    }
    res.status(500).json({ error: userFacingError(err?.message, 'parts') });
  }
});

router.get('/jobs', async (req, res) => {
  const jobs = await Job.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ jobs });
});

export default router;
