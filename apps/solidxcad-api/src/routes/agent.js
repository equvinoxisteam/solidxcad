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
import { searchStepParts } from '../services/cadWorker.js';
import { resolveChatModel, getChatModels } from '../services/models.js';
import { runSkillPipeline, resolveSkillFromChat, normalizePipelineResult } from '../services/skillOrchestrator.js';
import { SKILLS, BROWSER_SKILLS } from '../services/skillRegistry.js';
import { ProjectFile } from '../models/ProjectFile.js';

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
    webSearch = false,
  } = req.body;
  const chatModel = resolveChatModel(requestedModel);
  if (!projectId || !message?.trim()) {
    return res.status(400).json({ error: 'projectId and message required' });
  }

  const project = await Project.findOne({ _id: projectId, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

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
    content: message.trim(),
    creditsUsed: usageCost(CREDIT_COSTS.chat),
  });

  const history = await ChatMessage.find({ projectId }).sort({ createdAt: 1 }).limit(30);
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const skillIntent = resolveSkillFromChat(message.trim(), '');
  const projectFiles = await ProjectFile.find({ projectId, userId: req.user._id }).sort({ createdAt: 1 });
  let systemPrompt = await getSystemPromptForSkill(skillIntent, { projectFiles });
  if (webSearch) {
    systemPrompt += '\n\n---\nWeb search is enabled for this turn. Use current web results for standards, dimensions, and product data when the user needs factual grounding.';
  }
  const maxTokens = maxTokensForSkill(skillIntent);

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let full = '';
    try {
      if (webSearch) {
        res.write(`data: ${JSON.stringify({ type: 'agent_phase', phase: 'searching', message: 'Searching the web for reference data…' })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'agent_phase', phase: 'reading', message: 'Reading your workspace…' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'agent_phase', phase: 'thinking', message: 'Designing your solution…' })}\n\n`);

      for await (const chunk of streamChatCompletion(messages, {
        model: chatModel,
        system: systemPrompt,
        maxTokens,
        webSearch: Boolean(webSearch),
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
      const resolvedSkill = resolveSkillFromChat(message.trim(), full);
      if (generateCad) {
        const historyForAgent = messages.map((m) => ({ role: m.role, content: m.content }));
        const conversationContext = buildConversationContext(historyForAgent, message.trim());
        if (shouldDeferPipeline({
          userMessage: message.trim(),
          assistantText: full,
          skill: resolvedSkill,
          history: historyForAgent,
          conversationContext,
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
            userMessage: message.trim(),
            assistantText: full,
            project,
            conversationContext,
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
      webSearch: Boolean(webSearch),
    });
    const assistantMsg = await ChatMessage.create({
      projectId,
      userId: req.user._id,
      role: 'assistant',
      content: reply,
    });

    let cadResult = null;
    let skill = resolveSkillFromChat(message.trim(), reply);
    let pipelineDeferred = false;
    if (generateCad) {
      const historyForAgent = messages.map((m) => ({ role: m.role, content: m.content }));
      const conversationContext = buildConversationContext(historyForAgent, message.trim());
      if (shouldDeferPipeline({
        userMessage: message.trim(),
        assistantText: reply,
        skill,
        history: historyForAgent,
        conversationContext,
      })) {
        pipelineDeferred = true;
        cadResult = { ok: true, skill: 'agent', deferred: true, hint: 'clarify' };
      } else {
        const pipeline = await runSkillPipeline({
          userId: req.user._id,
          projectId: project._id,
          userMessage: message.trim(),
          assistantText: reply,
          project,
          conversationContext,
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
