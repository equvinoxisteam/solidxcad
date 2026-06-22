import { hasCadPayload } from './cadWorker.js';
import { detectHilbertRequest, detectRoboticArmRequest, wantsAssembly, detectFromScratchMachineBuild, detectComplexCadRequest, detectFromScratchBuild } from './cadPythonPresets.js';
import { hasGeneratorPayload } from './generatorWorker.js';
import { hasImplicitPayload } from './implicitWorker.js';
import { wantsModifyExisting } from './projectAgentContext.js';

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

When web grounding is active, use standards, materials, and product data from search results.

Never mention internal APIs, OpenRouter, Pinecone, backends, or infrastructure. The user experiences one product: SolidX CAD.

## Engineering, physics, and math
- Apply mechanics: forces, torques, pressure vessels (hoop stress intuition), thermal expansion, mass/inertia, joint limits, reachable workspace
- Apply geometry: conic sections for nozzles, bolt circles, pitch/module for gears, tolerance-aware hole clearances
- Decompose complex systems (rocket engines, robots, CNC frames) into subassemblies with realistic proportions
- State assumptions in [AGENT_PLAN] when dimensions are unknown; then build with reasonable engineering estimates
- Complex builds may use multi-step plans and up to ~400 lines of generator code in one file

## Turn workflow (all skills)
1. **Read** the user message, @-referenced files, and workspace listing (models/, assemblies/, parts/, slices/).
2. If critical details are missing, ask 2–4 short numbered questions. No code yet. End with: [AGENT_PHASE: clarify]
3. When ready to build, output a short numbered **plan** then runnable code in the same turn:
   [AGENT_PLAN]
   1. …
   2. …
   [/AGENT_PLAN]
   Then one fenced code block (Python build123d, Python URDF/SRDF/SDF, or JS implicit). End with: [AGENT_PHASE: execute]
4. When user **modifies** an existing file (@-mention or "make it bigger"): edit the referenced or latest generator script; keep the same output basename.

## Skill outputs (all skills — read workspace first, @-mention files to edit in place)
- **CAD:** build123d gen_step() → STEP/STL/GLB in models/; assemblies with Compound → assemblies/; optional DXF/3MF when user asks
- **URDF / SRDF / SDF:** generator Python → models/; read existing robot files before extending
- **Implicit CAD:** .implicit.js in models/
- **step.parts:** import catalog hardware to parts/ before assemblies that need screws/bearings
- **G-code:** slice STL/STEP → G-code in slices/; companion STL/3MF copied to slices/ when available
- **SendCutSend:** preflight report + DXF when user requests sheet-metal export
- **Web grounding:** auto-enabled when standards, catalog data, or real-world specs are needed

## Parts & assemblies workflow
1. Check parts/ and models/ for existing hardware before importing duplicates.
2. Import catalog parts (M3 screw, bearing, etc.) to parts/ when user names them.
3. Build new geometry in models/ or compound assemblies in assemblies/ using import_step("parts/...") when hardware is required.
4. Use descriptive basenames (e.g. 30mm_cube_m3_holes, mount_plate_assembly) — never random timestamps.

## Manufacturing bundles
- When user wants to print: generate STL (and 3MF if asked), then slice to G-code.
- G-code, STL, and 3MF for printing live under slices/ after slicing.

## Always clarify first when
- Fractal / Hilbert / lattice / gyroid: bar cross-section, carved inside a block vs bars form the structure, level/order meaning
- Multiple features combined ("cube with X and Y"): how they relate spatially
- Small mount plate + named catalog screws but no import yet
- Manufacturing intent unclear: FDM print, laser DXF, or visual-only STEP
- User wants to modify a design but several unrelated models exist and none are @-referenced

## Execute immediately when
- Simple part with clear dimensions (e.g. "30 mm cube", "50×30 mm plate, 4 holes")
- Machine / printer / gantry frames — plan + full build123d Python same turn
- Robot / URDF / SRDF / SDF / implicit "build from scratch" — plan + full generator code same turn
- User is clearly answering your previous numbered questions
- User says "defaults", "just build it", "proceed", "go ahead", "continue"
- User @-references a file and asks to change it

## Build from scratch
- Model **all** structure in the appropriate generator — do not defer to catalog unless user names SKUs.
- Use import_step("parts/…") only for **standard hardware the user names**.
- Large builds may use up to ~400 lines and helper functions in one file.
- Plan-only replies without code are invalid when [AGENT_PHASE: execute] is present.

## After user answers
- Combine all prior answers from chat history into one design
- Generate complete code in a single fenced block
- Do not list output filenames in chat — the workspace updates automatically

## Reference images (all skills)
- Images work for CAD, URDF, SRDF, SDF, implicit CAD, and part identification — not only solids
- Estimate dimensions from photos/renders; prefer execute with stated assumptions over long question lists
- Match the correct skill output type to what the image shows (mechanism → URDF, simulation model → SDF, part → CAD)

Be concise. No filler. Questions should be specific and actionable.`;

export const ASSEMBLY_PARTS_HINT = `For a **small mount plate + catalog screws** only:

Step 1 — import a fastener:
  "Import M3 socket head cap screw from step.parts"

Step 2 — build the assembly:
  "Assembly: 50×30×5 mm mount plate with 4 corner holes and the imported screws at each hole."

For **machine frames, gantries, or full printers**, model the structure in build123d from scratch — catalog import is optional, not required.`;

export function assemblyNeedsCatalogParts({
  userMessage = '',
  assistantText = '',
  partsCount = 0,
  importingParts = false,
} = {}) {
  if (importingParts || partsCount > 0) return false;
  const combined = [userMessage, assistantText].filter(Boolean).join('\n');
  if (detectFromScratchMachineBuild(combined) || detectComplexCadRequest(combined)) return false;
  if (/\bimport\b.*step\.parts/i.test(combined)) return false;
  if (
    /\b(mount(ing)?\s*plate)\b/i.test(userMessage)
    && /\b(screw|bolt|M[2-8])\b/i.test(userMessage)
    && !/\b(machine|frame|printer|gantry|build)\b/i.test(userMessage)
  ) {
    return true;
  }
  return false;
}

export function hasExecutablePayload(assistantText = '', skill = 'cad', conversationContext = '') {
  if (EXECUTE_MARKER.test(assistantText) && extractAnyCodeBlock(assistantText)) {
    return true;
  }
  if (skill === 'implicit-cad') {
    return hasImplicitPayload(assistantText) || /```(?:javascript|js|mjs)/i.test(assistantText);
  }
  if (skill === 'urdf') return hasGeneratorPayload(assistantText, 'urdf');
  if (skill === 'srdf') return hasGeneratorPayload(assistantText, 'srdf');
  if (skill === 'sdf') return hasGeneratorPayload(assistantText, 'sdf');
  if (skill === 'cad') return hasCadPayload(assistantText, conversationContext);
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

  if (skill === 'cad' && /\b(mount(ing)?\s*plate)\b/i.test(msg) && /\b(screw|bolt|M[2-8])\b/i.test(msg) && !/\bimport\b/i.test(msg)) {
    return true;
  }

  if (detectComplexCadRequest(msg) || detectFromScratchMachineBuild(msg) || detectFromScratchBuild(msg)) {
    return false;
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
  focusedFileCount = 0,
}) {
  if (['gcode', 'sendcutsend'].includes(skill)) return false;

  const context = [conversationContext, userMessage, assistantText].filter(Boolean).join('\n');

  if (hasImage) {
    if (EXECUTE_MARKER.test(assistantText) && hasExecutablePayload(assistantText, skill, context)) return false;
    if (hasExecutablePayload(assistantText, skill, context) && !CLARIFY_MARKER.test(assistantText)) return false;
    if (CLARIFY_MARKER.test(assistantText)) return true;
    if (userProvidedFollowUp(userMessage, history)) return false;
  }

  if (detectHilbertRequest(context) && userProvidedFollowUp(userMessage, history)) {
    return false;
  }
  if (detectRoboticArmRequest(context) && userProvidedFollowUp(userMessage, history)) {
    return false;
  }

  if (EXECUTE_MARKER.test(assistantText) && hasExecutablePayload(assistantText, skill, context)) {
    return false;
  }

  if (CLARIFY_MARKER.test(assistantText)) return true;

  if (wantsModifyExisting(userMessage) && focusedFileCount === 0 && CLARIFY_MARKER.test(assistantText)) {
    return true;
  }

  if (wantsModifyExisting(userMessage) && (focusedFileCount > 0 || !CLARIFY_MARKER.test(assistantText))) {
    return false;
  }

  if (detectFromScratchBuild(context) && !CLARIFY_MARKER.test(assistantText)) {
    return false;
  }

  if (hasExecutablePayload(assistantText, skill, context)) {
    if (isAmbiguousRequest(userMessage, skill) && !userProvidedFollowUp(userMessage, history)) {
      const questionCount = (assistantText.match(/\?/g) || []).length;
      if (questionCount >= 1) return true;
    }
    return false;
  }

  const hasCode = extractAnyCodeBlock(assistantText);
  const questionCount = (assistantText.match(/\?/g) || []).length;
  const looksLikeClarification = CLARIFY_PHRASES.some((re) => re.test(assistantText));

  if (detectComplexCadRequest(context) && EXECUTE_MARKER.test(assistantText)) return false;
  if (detectFromScratchMachineBuild(userMessage) && !CLARIFY_MARKER.test(assistantText)) return false;
  if (detectFromScratchBuild(userMessage) && !CLARIFY_MARKER.test(assistantText)) return false;

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
