const PART_NOUNS = [
  'cube', 'box', 'bracket', 'plate', 'mount', 'enclosure', 'gear', 'cylinder',
  'screw', 'housing', 'frame', 'lid', 'cover', 'spacer', 'washer', 'pin',
  'shaft', 'hub', 'flange', 'bushing', 'pulley', 'coupling', 'clamp',
  'standoff', 'block', 'panel', 'tray', 'chassis', 'base',
];

const ROBOT_NOUNS = ['robot', 'arm', 'manipulator', 'gripper', 'linkage', 'urdf'];

function slugify(parts) {
  return parts
    .map((p) => String(p || '').toLowerCase().replace(/[^a-z0-9]+/g, '_'))
    .filter(Boolean)
    .join('_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 56);
}

/**
 * Build a human-readable basename from the user's prompt (no timestamps).
 */
export function deriveFriendlyFileBase(userMessage = '', { skill = 'cad', isAssembly = false } = {}) {
  let text = String(userMessage || '').trim();
  text = text.replace(/@[\w.-]+/g, ' ');

  const tokens = [];

  const dims = text.match(/(\d+(?:\.\d+)?)\s*(?:x\s*(\d+(?:\.\d+)?))?\s*(?:x\s*(\d+(?:\.\d+)?))?\s*mm/i);
  if (dims) {
    const parts = [dims[1], dims[2], dims[3]].filter(Boolean).map((d) => `${d}mm`);
    if (parts.length === 1) tokens.push(parts[0]);
    else if (parts.length >= 2) tokens.push(parts.join('x'));
  } else {
    const single = text.match(/\b(\d+(?:\.\d+)?)\s*mm\b/i);
    if (single) tokens.push(`${single[1]}mm`);
  }

  const nounList = skill === 'urdf' || skill === 'srdf' ? ROBOT_NOUNS : PART_NOUNS;
  for (const noun of nounList) {
    const re = new RegExp(`\\b${noun}s?\\b`, 'i');
    if (re.test(text) && !tokens.includes(noun)) {
      tokens.push(noun);
    }
  }

  const fastener = text.match(/\b(m[2-8](?:\s*x\s*\d+)?)\b/i);
  if (fastener) tokens.push(fastener[1].toLowerCase().replace(/\s+/g, ''));

  if (/\bhole/i.test(text)) tokens.push('holes');
  if (/\bfillet/i.test(text)) tokens.push('filleted');
  if (/\bhelical\b/i.test(text)) tokens.push('helical');
  if (/\bspur\b/i.test(text)) tokens.push('spur');
  if (/\bgear/i.test(text) && !tokens.includes('gear')) tokens.push('gear');
  if (/\bimplicit\b/i.test(text)) tokens.push('implicit');
  if (/\bgazebo\b/i.test(text) || skill === 'sdf') tokens.push('gazebo');
  if (/\bmoveit\b/i.test(text) || skill === 'srdf') tokens.push('moveit');

  if (isAssembly || /\bassembl/i.test(text)) {
    if (!tokens.some((t) => t.includes('assembly'))) tokens.push('assembly');
  }

  let base = slugify(tokens);
  if (!base) {
    if (skill === 'urdf' || skill === 'srdf') base = 'robot_arm';
    else if (skill === 'sdf') base = 'sim_model';
    else if (skill === 'implicit-cad') base = 'implicit_shape';
    else if (isAssembly) base = 'mount_assembly';
    else base = 'custom_part';
  }

  return base;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip _updated or _N version suffix to get the design root name. */
export function stripVersionSuffix(base = '') {
  return String(base || '')
    .replace(/_updated$/i, '')
    .replace(/_\d+$/i, '');
}

/**
 * Next basename when modifying an existing design:
 * gear_spur → gear_spur_updated → gear_spur_1 → gear_spur_2 …
 */
export function resolveNextVersionedBase(sourceBase = '', projectFiles = [], storageFolder = 'models') {
  const root = stripVersionSuffix(sourceBase) || 'custom_part';
  const inFolder = (file) => String(file?.s3Key || '').includes(`/${storageFolder}/`);
  const versionPattern = new RegExp(
    `^${escapeRegExp(root)}(?:_updated|_\\d+)?\\.(step|stp|stl|glb|urdf|srdf|sdf)$`,
    'i',
  );

  const related = projectFiles.filter((f) => inFolder(f) && versionPattern.test(f.name));
  const bases = new Set(related.map((f) => baseNameFromFileName(f.name)));

  if (!bases.size || (bases.size === 1 && bases.has(root))) {
    return `${root}_updated`;
  }
  if (!bases.has(`${root}_updated`) && ![...bases].some((b) => /^.+_\d+$/.test(b))) {
    return `${root}_updated`;
  }

  let maxN = 0;
  for (const base of bases) {
    const match = base.match(new RegExp(`^${escapeRegExp(root)}_(\\d+)$`));
    if (match) maxN = Math.max(maxN, Number.parseInt(match[1], 10) || 0);
  }
  if (maxN === 0 && bases.has(`${root}_updated`)) {
    return `${root}_1`;
  }
  return `${root}_${maxN + 1}`;
}

function baseNameFromFileName(name = '') {
  return String(name).replace(/\.[^.]+$/, '');
}
