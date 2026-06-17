import { hasCadPayload } from './cadWorker.js';
import { detectHilbertRequest, detectRoboticArmRequest, wantsAssembly } from './cadPythonPresets.js';
import { hasGeneratorPayload } from './generatorWorker.js';
import { hasImplicitPayload } from './implicitWorker.js';

const CLARIFY_MARKER = /\[AGENT_PHASE:\s*clarify\]/i;
const EXECUTE_MARKER = /\[AGENT_PHASE:\s*execute\]/i;

const CLARIFY_PHRASES = [
  /before i (generate|build|create|write|proceed)/i,
  /i need (a few |some )?(more )?details/i,
  /could you (clarify|confirm|specify)/i,
  /please (confirm|clarify|specify|let me know)/i,
  /which of the following/i,
  /a few questions/i,
  /quick questions/i,
];

export const AGENT_CORE_PROMPT = `You are the SolidX CAD Design Assistant — a capable agentic CAD partner. Plan, explore the project workspace, ask when needed, then build and self-correct. Speak confidently: SolidX CAD can model parts, assemblies, robots (URDF/SRDF/SDF), implicit shapes, catalog imports, and manufacturing prep. Never tell the user the platform "cannot" do something — instead clarify requirements and build, or ask focused questions.

When web search is enabled, use grounded facts for standards (ISO threads, bearing sizes, board dimensions), material specs, and product references — then incorporate them into the design.

Never mention internal APIs, OpenRouter, backends, or infrastructure. The user experiences one product: SolidX CAD.

## Turn workflow
1. **Read** the user message and the project workspace listing below (models/, parts/, slices/, .py scripts).
2. If important details are missing, ask 2–4 short numbered questions. No code yet. End with: [AGENT_PHASE: clarify]
3. When ready to build, output a short numbered **plan** then runnable code:
   [AGENT_PLAN]
   1. …
   2. …
   [/AGENT_PLAN]
   Then one fenced code block (Python or JS per skill). End with: [AGENT_PHASE: execute]
4. When user **modifies** an existing part: edit the latest .py script shown below; do not start from scratch unless asked.

## Always clarify first when
- Fractal / Hilbert / lattice / gyroid: bar cross-section, carved inside a block vs bars form the structure, level/order meaning
- Multiple features combined ("cube with X and Y"): how they relate spatially
- Assemblies: what exists in parts/ vs must be modeled; hole counts and spacing
- Manufacturing intent unclear: FDM print, laser DXF, or visual-only STEP
- User wants to modify an existing file but did not name which one

## Execute immediately when
- Simple part with clear dimensions (e.g. "30 mm cube", "50×30 mm plate, 4 holes")
- Mechanical robotic arm / manipulator (STEP solid with links, flange bolts, gripper) — use build123d gen_step(); pipeline applies a tested 6-DOF preset when code would be too long
- User is clearly answering your previous numbered questions
- User says "defaults", "just build it", "proceed", "go ahead", "continue"

## After user answers
- Combine all prior answers from chat history into one design
- Generate complete code in a single fenced block
- Briefly list files the pipeline will create (STEP, STL, GLB, .py sidecar, etc.)

## Reference images
When the user attaches an image, infer shape and approximate dimensions from the image. Prefer executing with reasonable estimates and [AGENT_PHASE: execute] rather than long question lists. Ask at most 1–2 critical questions only when scale or feature count is truly ambiguous.

## Components and catalog parts
When an assembly needs fasteners, bearings, or standard parts, import from step.parts in the same turn when possible (e.g. "Import M3 socket head cap screw from step.parts") then build the assembly. Do not ask the user to hunt for parts if a catalog import solves it.

Be concise. No filler. Questions should be specific and actionable.`;

export const ASSEMBLY_PARTS_HINT = `Assembly tree needs at least one catalog part in parts/ first.

Step 1 — import a fastener:
  "Import M3 socket head cap screw from step.parts"

Step 2 — build the assembly:
  "Assembly: 50×30×5 mm mount plate with 4 corner holes and the imported screws at each hole."

Open the resulting .step in CAD Viewer (not STL) to see the assembly tree in the left sidebar.`;

export function assemblyNeedsCatalogParts({
  userMessage = '',
  partsCount = 0,
  importingParts = false,
} = {}) {
  if (importingParts || partsCount > 0) return false;
  return wantsAssembly(userMessage);
}

export function hasExecutablePayload(assistantText = '', skill = 'cad') {
  if (EXECUTE_MARKER.test(assistantText) && extractAnyCodeBlock(assistantText)) {
    return true;
  }
  if (skill === 'implicit-cad') {
    return hasImplicitPayload(assistantText) || /```(?:javascript|js|mjs)/i.test(assistantText);
  }
  if (skill === 'urdf') return hasGeneratorPayload(assistantText, 'urdf');
  if (skill === 'srdf') return hasGeneratorPayload(assistantText, 'srdf');
  if (skill === 'sdf') return hasGeneratorPayload(assistantText, 'sdf');
  if (skill === 'cad') return hasCadPayload(assistantText);
  if (['gcode', 'sendcutsend'].includes(skill)) return true;
  if (skill === 'step-parts') return /\b(import|from step\.parts)\b/i.test(assistantText);
  return false;
}

function extractAnyCodeBlock(text) {
  return /```[\s\S]*?```/.test(text);
}

export function isAmbiguousRequest(userMessage = '', skill = 'cad') {
  const msg = userMessage.trim();
  if (!msg) return false;

  if (/\bhilbert\b/i.test(msg)) {
    const hasBarSize = /\d+(\.\d+)?\s*mm.*\b(bar|square|cross|tube|profile|thick)/i.test(msg)
      || /\b(bar|square)\s*\d+/i.test(msg);
    const hasMode = /\b(inside|carved|subtractive|from bars|bar structure|solid cube)\b/i.test(msg);
    if (!hasBarSize || !hasMode) return true;
  }

  if (/\b(fractal|lattice|gyroid|voronoi)\b/i.test(msg) && !/\d+\s*mm/i.test(msg)) {
    return true;
  }

  if (skill === 'cad' && /\b(assembly|assemble)\b/i.test(msg) && !/\bimport\b/i.test(msg)) {
    return true;
  }

  return false;
}

export function userProvidedFollowUp(userMessage = '', history = []) {
  const msg = userMessage.trim().toLowerCase();
  if (!msg) return false;
  if (/^(yes|no|go ahead|proceed|continue|use defaults?|just build|sounds good|that works)/i.test(msg)) {
    return true;
  }
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant && CLARIFY_MARKER.test(lastAssistant.content)) {
    return true;
  }
  return false;
}

export function shouldDeferPipeline({
  userMessage = '',
  assistantText = '',
  skill = 'cad',
  history = [],
  conversationContext = '',
  hasImage = false,
}) {
  if (['gcode', 'sendcutsend'].includes(skill)) return false;

  if (hasImage) {
    if (EXECUTE_MARKER.test(assistantText) && hasExecutablePayload(assistantText, skill)) return false;
    if (hasExecutablePayload(assistantText, skill) && !CLARIFY_MARKER.test(assistantText)) return false;
    if (CLARIFY_MARKER.test(assistantText)) return true;
    if (userProvidedFollowUp(userMessage, history)) return false;
  }

  const context = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');
  if (detectHilbertRequest(context) && userProvidedFollowUp(userMessage, history)) {
    return false;
  }
  if (detectRoboticArmRequest(context) && userProvidedFollowUp(userMessage, history)) {
    return false;
  }

  if (EXECUTE_MARKER.test(assistantText) && hasExecutablePayload(assistantText, skill)) {
    return false;
  }

  if (CLARIFY_MARKER.test(assistantText)) return true;

  if (hasExecutablePayload(assistantText, skill)) {
    if (isAmbiguousRequest(userMessage, skill) && !userProvidedFollowUp(userMessage, history)) {
      const questionCount = (assistantText.match(/\?/g) || []).length;
      if (questionCount >= 1) return true;
    }
    return false;
  }

  const hasCode = extractAnyCodeBlock(assistantText);
  const questionCount = (assistantText.match(/\?/g) || []).length;
  const looksLikeClarification = CLARIFY_PHRASES.some((re) => re.test(assistantText));

  if (!hasCode && (looksLikeClarification || questionCount >= 2)) return true;
  if (!hasCode && questionCount >= 1 && isAmbiguousRequest(userMessage, skill)) return true;

  return false;
}

export function stripAgentMarkers(text = '') {
  return text
    .replace(/\[AGENT_PHASE:\s*(clarify|execute|plan)\]\s*/gi, '')
    .replace(/\[AGENT_PLAN\][\s\S]*?\[\/AGENT_PLAN\]/gi, '')
    .trim();
}

export function extractAgentPlan(text = '') {
  const match = text.match(/\[AGENT_PLAN\]([\s\S]*?)\[\/AGENT_PLAN\]/i);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[\).\]]\s*/, '').trim())
    .filter(Boolean);
}

export function detectAgentPhase(text = '') {
  if (/\[AGENT_PHASE:\s*clarify\]/i.test(text)) return 'asking';
  if (/\[AGENT_PHASE:\s*execute\]/i.test(text)) return 'executing';
  if (/\[AGENT_PLAN\]/i.test(text)) return 'planning';
  if (/\?/.test(text) && text.length < 800) return 'asking';
  return 'thinking';
}
