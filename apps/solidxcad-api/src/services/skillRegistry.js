/**
 * Maps browser chat intents to repo skills under TEXT_TO_CAD_ROOT/skills/.
 */

import { detectRoboticArmRequest, wantsAssembly } from './cadPythonPresets.js';

export { wantsAssembly };

export const SKILLS = {
  cad: {
    id: 'cad',
    label: 'CAD',
    dir: 'skills/cad',
    description: 'build123d gen_step() → STEP/STL/GLB/DXF/3MF',
  },
  urdf: {
    id: 'urdf',
    label: 'URDF',
    dir: 'skills/urdf',
    description: 'Robot descriptions → .urdf',
  },
  srdf: {
    id: 'srdf',
    label: 'SRDF',
    dir: 'skills/srdf',
    description: 'MoveIt semantic groups → .srdf',
  },
  sdf: {
    id: 'sdf',
    label: 'SDF',
    dir: 'skills/sdf',
    description: 'Gazebo/SDFormat → .sdf',
  },
  'implicit-cad': {
    id: 'implicit-cad',
    label: 'Implicit CAD',
    dir: 'skills/implicit-cad',
    description: 'SDF raymarch → .implicit.js',
  },
  gcode: {
    id: 'gcode',
    label: 'G-code',
    dir: 'skills/gcode',
    description: 'Mesh → slicer G-code',
  },
  'step-parts': {
    id: 'step-parts',
    label: 'step.parts',
    dir: 'skills/step-parts',
    description: 'Catalog STEP fasteners & boards',
  },
  sendcutsend: {
    id: 'sendcutsend',
    label: 'SendCutSend',
    dir: 'skills/sendcutsend',
    description: 'Sheet-metal preflight reports',
  },
  'cad-viewer': {
    id: 'cad-viewer',
    label: 'CAD Viewer',
    dir: 'viewer',
    description: 'STEP/URDF/G-code preview',
  },
};

const URDF_RE = /\b(urdf|robot|robotic|manipulator|arm|hand|gripper|link|joint|rviz)\b/i;
const SRDF_RE = /\b(srdf|moveit|semantic|planning\s*group|collision\s*pair)\b/i;
const SDF_RE = /\b(gazebo|sdformat|\.sdf\b)\b/i;
const IMPLICIT_RE = /\b(implicit\s*cad|implicit\.js|signed[- ]distance|raymarch|sdf\s*\(\s*vec3)\b/i;
const CAD_RE = /\b(step|stl|box|bracket|mount|enclosure|part|mm|build123d|cad|model|gear|cylinder|assembly|assemble)\b/i;
const SLICE_RE = /\b(slice|slicing|gcode|g-code|print|fdm|orca|prusa|3d\s*print)\b/i;
const PARTS_RE = /\b(m3|m4|screw|bearing|bolt|washer|fastener|step\.parts|catalog\s*part|import\s+part)\b/i;
const SENDCUT_RE = /\b(sendcutsend|send\s*cut\s*send|laser\s*cut\s*order)\b/i;

const URDF_EXPLICIT_RE = /\b(urdf|ros\b|rviz|moveit|gazebo\s+sim)\b/i;
const ROBOT_MECH_CAD_RE = /\b(step\b|stl\b|screw|bolt|mechanical|solid\s+model|build123d|flange|3d\s+print|fully\s+work|gripper|mm|cad)\b/i;

export function detectSkillIntent(userMessage = '', assistantText = '') {
  const user = userMessage.trim();
  const combined = `${user} ${assistantText}`;

  if (assistantText.includes('gen_step') || /from build123d import/i.test(assistantText)) {
    return 'cad';
  }
  if (assistantText.includes('gen_urdf') && !assistantText.includes('gen_step')) {
    return 'urdf';
  }

  if (assistantText.includes('gen_srdf') || (SRDF_RE.test(user) && !IMPLICIT_RE.test(user))) {
    return 'srdf';
  }
  if (assistantText.includes('gen_sdf') || (SDF_RE.test(user) && !IMPLICIT_RE.test(user))) {
    return 'sdf';
  }
  if (SENDCUT_RE.test(user)) return 'sendcutsend';
  if (IMPLICIT_RE.test(user) || assistantText.includes('implicit.js/0.1.0')) {
    return 'implicit-cad';
  }
  if (SLICE_RE.test(user) && !CAD_RE.test(user) && !URDF_RE.test(user)) {
    return 'gcode';
  }
  if (PARTS_RE.test(user) && !CAD_RE.test(user) && !URDF_RE.test(user)) {
    return 'step-parts';
  }
  if (URDF_EXPLICIT_RE.test(user) || (assistantText.includes('gen_urdf') && !assistantText.includes('gen_step'))) {
    return 'urdf';
  }
  if (detectRoboticArmRequest(combined)) {
    return 'cad';
  }
  if (URDF_RE.test(user) && ROBOT_MECH_CAD_RE.test(combined) && /\b(step|stl|solid|mechanical|build123d)\b/i.test(user)) {
    return 'cad';
  }
  if (URDF_RE.test(user)) {
    return 'urdf';
  }
  return 'cad';
}

export function wantsSliceAfterCad(userMessage = '') {
  return SLICE_RE.test(userMessage);
}

export function wantsStandaloneSlice(userMessage = '') {
  return SLICE_RE.test(userMessage) && !/\b(make|create|design|build|generate)\b/i.test(userMessage);
}

export function wantsSrdfAfterUrdf(userMessage = '') {
  return SRDF_RE.test(userMessage);
}

export function wantsDxfExport(userMessage = '') {
  return /\b(dxf|2d\s*drawing|laser\s*cut|flat\s*pattern|sendcutsend)\b/i.test(userMessage);
}

export function wants3mfExport(userMessage = '') {
  return /\b(3mf|three\s*mf)\b/i.test(userMessage);
}

export function wantsImplicitMeshExport(userMessage = '') {
  return /\b(stl|glb|3mf|mesh|export)\b/i.test(userMessage);
}

export function implicitExportFormats(userMessage = '') {
  const formats = new Set(['glb', 'stl']);
  if (wants3mfExport(userMessage)) formats.add('3mf');
  if (/\bglb\b/i.test(userMessage)) formats.add('glb');
  if (/\bstl\b/i.test(userMessage)) formats.add('stl');
  return [...formats];
}

export function skillMeta(skillId) {
  return SKILLS[skillId] || SKILLS.cad;
}

export const BROWSER_SKILLS = [
  'cad', 'urdf', 'srdf', 'sdf', 'implicit-cad', 'gcode', 'step-parts', 'sendcutsend', 'cad-viewer',
];
