import { config } from '../config.js';
import { AGENT_CORE_PROMPT } from './agentBehavior.js';
import { normalizeAssistantReply } from './agentReply.js';

export { normalizeAssistantReply };
import { buildRichProjectContext } from './projectAgentContext.js';

async function projectFilesContext(files = []) {
  if (!files.length) return '';
  return buildRichProjectContext(files);
}

const CAD_SYSTEM_PROMPT = `Skill: skills/cad — generate runnable build123d (Python) with gen_step().

ALLOWED APIs:
- from build123d import *
- import numpy as np (for Hilbert/lattice point lists only)
- Primitives: Box, Cylinder, Sphere, Cone
- Sketch: Rectangle, Circle, Polygon; extrude(), revolve(), loft(), sweep(), fillet(), chamfer()
- Patterns: Locations, GridLocations, PolarLocations
- Combine: Compound, Pos, Rot, fuse / cut booleans
- Holes: Hole(radius=d/2) — never diameter= on Hole
- import_step(path) for catalog parts in parts/
- Units: millimeters

FORBIDDEN: Helical, Gear, InvoluteGear, invented APIs.

Parametric curves (Hilbert level 3, lattices):
- Generate 3D polyline points in Python (numpy ok)
- Build each edge as a separate Box; collect in a list
- Union with successive fuse — NEVER Compound([...]) with list comprehensions that may yield None:
  part = boxes[0]
  for b in boxes[1:]:
      part = part + b
- Optional: clip to outer Box envelope with boolean cut
- Prefer level 2 for reliability; level 3 only if user insists

Template:
\`\`\`python
from build123d import *

def gen_step():
    part = Box(30, 30, 30)
    return part
\`\`\`

DXF/laser: also define gen_dxf() when requested.

Robotic arms (mechanical STEP, not URDF):
- Prefer Compound(label="arm", children=[base, links, bolts, gripper]) for multi-link arms
- Keep under ~100 lines; the pipeline also has a tested 6-DOF desktop arm preset

Rules:
- gen_step() returns final solid; no export_step/export_stl (pipeline writes files)
- Under ~120 lines; split helpers inside the same file
- Do not list output filenames in chat prose`;

const URDF_SYSTEM_PROMPT = `You are SolidX CAD — generate runnable URDF via Python gen_urdf() for the skills/urdf skill.

Use ONLY xml.etree.ElementTree (stdlib). Define a top-level zero-argument gen_urdf() that returns the robot root Element.

Template:
\`\`\`python
import xml.etree.ElementTree as ET

def gen_urdf():
    robot = ET.Element("robot", name="simple_arm")
    base = ET.SubElement(robot, "link", name="base_link")
    ET.SubElement(base, "visual").append(ET.fromstring(
        '<geometry><box size="0.1 0.1 0.05"/></geometry>'
    ))
    arm = ET.SubElement(robot, "link", name="arm_link")
    joint = ET.SubElement(robot, "joint", name="joint1", type="revolute")
    ET.SubElement(joint, "parent", link="base_link")
    ET.SubElement(joint, "child", link="arm_link")
    ET.SubElement(joint, "origin", xyz="0 0 0.05", rpy="0 0 0")
    ET.SubElement(joint, "axis", xyz="0 0 1")
    ET.SubElement(joint, "limit", lower="-1.57", upper="1.57", effort="10", velocity="1")
    return robot
\`\`\`

Rules:
- ALWAYS return Python with gen_urdf() — never raw XML-only blocks
- Meters for URDF units unless user specifies otherwise
- Keep under 120 lines; start simple for hands (palm + 2-3 finger links)
- Brief explanation outside the code block
- For complex hands: palm link + revolute finger joints, no mesh files required (use box/cylinder geometry)`;

const SRDF_SYSTEM_PROMPT = `You are SolidX CAD — generate MoveIt SRDF via Python gen_srdf() for skills/srdf.

Define gen_srdf() returning the robot root Element (xml.etree.ElementTree). Include planning groups, disable collisions, and end-effector groups when appropriate.

\`\`\`python
import xml.etree.ElementTree as ET

def gen_srdf():
    robot = ET.Element("robot", name="my_robot")
    # groups, disable_collisions, etc.
    return robot
\`\`\`

Rules:
- ALWAYS Python with gen_srdf() — not raw XML only
- Assume a matching URDF exists in the same project
- Keep under 120 lines`;

const SDF_SYSTEM_PROMPT = `You are SolidX CAD — generate SDFormat models via Python gen_sdf() for skills/sdf.

\`\`\`python
import xml.etree.ElementTree as ET

def gen_sdf():
    sdf = ET.Element("sdf", version="1.9")
    model = ET.SubElement(sdf, "model", name="robot")
    return sdf
\`\`\`

Rules:
- ALWAYS Python with gen_sdf()
- Meters for SDF unless user specifies otherwise`;

const IMPLICIT_SYSTEM_PROMPT = `You are SolidX CAD — generate implicit CAD as ES module .implicit.js for CAD Viewer.

\`\`\`javascript
export default {
  schema: "implicit.js/0.1.0",
  name: "rounded box",
  glsl: \`
float sdf(vec3 p) {
  return implicit_box_centered(p, vec3(30.0, 20.0, 10.0), vec3(0.0));
}
vec3 color(vec3 p, vec3 normal) {
  return vec3(0.2, 0.55, 0.95);
}
\`,
};
\`\`\`

Rules:
- Use implicit_* GLSL helpers only
- Millimeters in geometry
- One complete export default block`;

const GCODE_SYSTEM_PROMPT = `You help users slice existing project meshes to G-code. Do not write Python. Tell them slicing runs via OrcaSlicer on the server after they have an STL/STEP part. Suggest: "Slice tab → Generate G-code" or ask to slice an existing part.`;

const PARTS_SYSTEM_PROMPT = `You help users import catalog parts from step.parts. Suggest specific part names (M3 socket head screw, 608 bearing, etc.). The agent will search and import automatically when asked.`;

const FIX_PROMPT = `Fix the build123d gen_step() Python script below. It failed when run.

Rules:
- Keep def gen_step(): returning one solid Shape
- Use Box, Cylinder, extrude, revolve, fillet, boolean + / -
- Holes: Hole(radius=d/2) — never diameter= on Hole
- For many segments (Hilbert/lattice): list of Box only, filter Nones, fuse in a loop:
    part = boxes[0]
    for b in boxes[1:]:
        part = part + b
- NEVER Compound(children=...) with invalid/None/tuple children
- No Helical, Gear, or invented APIs
- No export_step/export_stl calls

Return ONLY a fixed \`\`\`python code block with gen_step().`;

function parseOpenRouterError(status, text) {
  try {
    const json = JSON.parse(text);
    const msg = json?.error?.message || text;
    if (status === 402) {
      return 'Design credits are low — try a faster model or add credits to continue.';
    }
    return msg;
  } catch {
    return text || `OpenRouter error ${status}`;
  }
}

function normalizeOpenRouterModel(model, webSearch = false) {
  const base = String(model || '').replace(/:online$/i, '').trim();
  if (!base) return config.openrouter.modelCad;
  return webSearch ? `${base}:online` : base;
}

function attachImageToMessages(messages, imageDataUrl) {
  if (!imageDataUrl || !messages.length) return messages;
  const copy = messages.map((m) => ({ ...m }));
  const lastUserIdx = [...copy].reverse().findIndex((m) => m.role === 'user');
  if (lastUserIdx < 0) return copy;
  const idx = copy.length - 1 - lastUserIdx;
  const text = copy[idx].content || '';
  copy[idx] = {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  };
  return copy;
}

async function callOpenRouter(messages, { model, stream = false, maxTokens, system, webSearch = false, imageDataUrl } = {}) {
  const resolvedModel = normalizeOpenRouterModel(model, webSearch);
  const payloadMessages = attachImageToMessages(messages, imageDataUrl);
  const response = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.openrouter.siteUrl,
      'X-Title': config.openrouter.appName,
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [{ role: 'system', content: system || CAD_SYSTEM_PROMPT }, ...payloadMessages],
      stream,
      temperature: 0.2,
      max_tokens: maxTokens ?? config.openrouter.maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(parseOpenRouterError(response.status, text));
    err.status = response.status;
    err.raw = text;
    throw err;
  }

  return response;
}

export async function chatCompletion(messages, { model, stream = false, maxTokens, system, webSearch = false, imageDataUrl } = {}) {
  if (!config.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const models = [
    { model: model || config.openrouter.modelCad, maxTokens: maxTokens ?? config.openrouter.maxTokens },
    { model: config.openrouter.modelFast, maxTokens: Math.min(800, config.openrouter.maxTokens) },
    { model: config.openrouter.modelFallback, maxTokens: 512 },
  ];

  let lastError;
  for (const attempt of models) {
    try {
      const response = await callOpenRouter(messages, {
        model: attempt.model,
        stream,
        maxTokens: attempt.maxTokens,
        system,
        webSearch,
        imageDataUrl,
      });
      if (stream) return response;
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      if (err.status !== 402) throw err;
      console.warn(`[openrouter] 402 on ${attempt.model}, trying fallback…`);
    }
  }

  throw lastError;
}

export async function repairPythonScript(brokenCode, errorMessage) {
  const reply = await chatCompletion(
    [{
      role: 'user',
      content: `${FIX_PROMPT}\n\nError:\n${errorMessage}\n\nScript:\n\`\`\`python\n${brokenCode}\n\`\`\``,
    }],
    { model: config.openrouter.modelFast, maxTokens: 900, system: FIX_PROMPT },
  );
  return extractPythonCode(reply);
}

export function extractPythonCode(text) {
  const match = text.match(/```(?:python)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
}

const PROMPTS = {
  cad: CAD_SYSTEM_PROMPT,
  urdf: URDF_SYSTEM_PROMPT,
  srdf: SRDF_SYSTEM_PROMPT,
  sdf: SDF_SYSTEM_PROMPT,
  'implicit-cad': IMPLICIT_SYSTEM_PROMPT,
  gcode: GCODE_SYSTEM_PROMPT,
  'step-parts': PARTS_SYSTEM_PROMPT,
  sendcutsend: `You help prepare STEP/DXF files for SendCutSend.com laser cutting. Ask for material/thickness if missing. The agent writes a preflight report from project files.`,
};

export async function getSystemPromptForSkill(skillId, { projectFiles } = {}) {
  const base = PROMPTS[skillId] || CAD_SYSTEM_PROMPT;
  const ctx = await projectFilesContext(projectFiles || []);
  const skillBlock = ctx ? `${base}${ctx}` : base;
  return `${AGENT_CORE_PROMPT}\n\n---\n\n${skillBlock}`;
}

export function maxTokensForSkill(skillId) {
  if (['urdf', 'srdf', 'sdf', 'implicit-cad'].includes(skillId)) return 2048;
  if (skillId === 'cad') return 2560;
  return undefined;
}

export async function* streamChatCompletion(messages, { model, system, maxTokens, webSearch = false, imageDataUrl } = {}) {
  const response = await chatCompletion(messages, { model, stream: true, system, maxTokens, webSearch, imageDataUrl });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
