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
  normalizeAssistantReply,
} from '../services/openrouter.js';
import { shouldDeferPipeline } from '../services/agentBehavior.js';
import { searchStepParts } from '../services/cadWorker.js';
import { resolveChatModel, getChatModels } from '../services/models.js';
import { modelLabel } from '../services/modelPicker.js';
import { buildFocusedFileContext } from '../services/projectAgentContext.js';
import { runSkillPipeline, resolveSkillFromChat, normalizePipelineResult } from '../services/skillOrchestrator.js';
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
    webSearch = false,
    contextFileIds = [],
    imageDataUrl = '',
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
  const hasImage = Boolean(imageDataUrl && String(imageDataUrl).startsWith('data:image/'));
  const effectiveWebSearch = Boolean(webSearch);
  const chatModel = resolveChatModel();

  try {
    await chargeCredits(req.user._id, CREDIT_COSTS.chat, 'chat', { projectId });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'Insufficient credits', balance: err.balance });
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
  let systemPrompt = await getSystemPromptForSkill(skillIntent, { projectFiles });
  systemPrompt += buildUserContextPrompt(req.user);
  const fileFocus = await buildFocusedFileContext(projectFiles, contextFileIds);
  if (fileFocus) systemPrompt += fileFocus;
  if (effectiveWebSearch) {
    systemPrompt += '\n\n---\nWeb search is enabled for this turn. Use current web results for standards, dimensions, and product data when the user needs factual grounding.';
  }
  if (hasImage) {
    systemPrompt += '\n\n---\nThe user attached a reference image. Infer dimensions, shape language, and features from the image; generate runnable CAD with reasonable estimates. Use [AGENT_PHASE: execute] when ready — avoid long clarification loops.';
  }
  const maxTokens = maxTokensForSkill(skillIntent, { userMessage: trimmedMessage });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let full = '';
    try {
      if (effectiveWebSearch) {
        res.write(`data: ${JSON.stringify({
          type: 'agent_phase',
          phase: 'searching',
          message: 'Searching the web for reference data…',
        })}\n\n`);
      }
      if (focusedFiles.length) {
        res.write(`data: ${JSON.stringify({ type: 'agent_phase', phase: 'exploring', message: `Reviewing ${focusedFiles.map((f) => f.name).join(', ')}…` })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({
        type: 'agent_phase',
        phase: 'reading',
        message: `Reading workspace · ${modelLabel(chatModel)}`,
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'agent_phase', phase: 'thinking', message: 'Designing your solution…' })}\n\n`);

      for await (const chunk of streamChatCompletion(messages, {
        model: chatModel,
        system: systemPrompt,
        maxTokens,
        webSearch: effectiveWebSearch,
        imageDataUrl: hasImage ? imageDataUrl : undefined,
      })) {
        full += chunk;
        res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`);
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
          focusedFileCount: focusedFiles.length,
        })) {
          pipelineDeferred = true;
          res.write(`data: ${JSON.stringify({
            type: 'agent_phase',
            phase: 'waiting',
            message: 'Waiting for your answers…',
          })}\n\n`);
          res.write(`data: ${JSON.stringify({
            type: 'cad_status',
            message: 'Asking clarifying questions — reply in chat to continue',
            skill: 'agent',
            status: 'asking',
          })}\n\n`);
          cadResult = { ok: true, skill: 'agent', deferred: true, hint: 'clarify' };
        } else {
          res.write(`data: ${JSON.stringify({
            type: 'agent_phase',
            phase: 'executing',
            message: 'Executing design pipeline…',
          })}\n\n`);
          const pipeline = await runSkillPipeline({
            res,
            userId: req.user._id,
            projectId: project._id,
            userMessage: trimmedMessage,
            assistantText: full,
            project,
            conversationContext,
            focusedFiles,
          });
          cadResult = normalizePipelineResult(pipeline.result);
          if (cadResult && pipeline.skill) cadResult.skill = cadResult.skill || pipeline.skill;
          if (cadResult?.deferred && cadResult?.hint === 'assembly_needs_parts') {
            pipelineDeferred = true;
          }
        }
      }

      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsg._id,
        cadResult,
        skill: resolvedSkill,
        pipelineDeferred,
        reply: normalizeAssistantReply(full),
        modelUsed: chatModel,
        webSearchUsed: effectiveWebSearch,
      })}\n\n`);
      res.end();
    } catch (err) {
      const safeError = /openrouter|api key|fetch failed/i.test(err.message || '')
        ? 'Design request interrupted — please try again.'
        : (err.message || 'Design request interrupted — please try again.');
      res.write(`data: ${JSON.stringify({ type: 'error', error: safeError })}\n\n`);
      res.end();
    }
    return;
  }

  try {
    const reply = await chatCompletion(messages, {
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
        focusedFileCount: focusedFiles.length,
      })) {
        pipelineDeferred = true;
        cadResult = { ok: true, skill: 'agent', deferred: true, hint: 'clarify' };
      } else {
        const pipeline = await runSkillPipeline({
          userId: req.user._id,
          projectId: project._id,
          userMessage: trimmedMessage,
          assistantText: reply,
          project,
          conversationContext,
          focusedFiles,
        });
        cadResult = normalizePipelineResult(pipeline.result);
        skill = pipeline.skill;
        if (cadResult?.deferred && cadResult?.hint === 'assembly_needs_parts') {
          pipelineDeferred = true;
        }
      }
    }

    res.json({
      reply: normalizeAssistantReply(reply),
      messageId: assistantMsg._id,
      cadResult,
      skill,
      pipelineDeferred,
      modelUsed: chatModel,
      webSearchUsed: effectiveWebSearch,
    });
  } catch (err) {
    console.error('[agent/chat]', err);
    res.status(500).json({ error: err.message || 'AI request failed' });
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
      return res.status(402).json({ error: 'Insufficient credits', balance: err.balance });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/jobs', async (req, res) => {
  const jobs = await Job.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ jobs });
});

export default router;
