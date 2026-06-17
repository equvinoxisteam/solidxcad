function humanizeId(id) {
  return String(id || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function addNumberParam(parameters, id, value, { unit = 'mm', minScale = 0.1, maxScale = 10 } = {}) {
  const key = String(id || '').trim();
  const numeric = Number(value);
  if (!key || !Number.isFinite(numeric) || numeric <= 0) {
    return;
  }
  if (parameters[key]) {
    return;
  }
  parameters[key] = {
    type: 'number',
    label: humanizeId(key),
    defaultValue: numeric,
    min: Math.max(0.1, numeric * minScale),
    max: Math.max(numeric * maxScale, numeric + 1),
    step: numeric >= 10 ? 1 : 0.1,
    unit,
  };
}

function genStepBody(source) {
  const text = String(source || '');
  const start = text.search(/def\s+gen_step\s*\(/);
  if (start < 0) {
    return text;
  }
  const colon = text.indexOf(':', start);
  if (colon < 0) {
    return text;
  }
  const lines = text.slice(colon + 1).split('\n');
  const bodyLines = [];
  for (const line of lines) {
    if (bodyLines.length && /^(?:def |class |@)/.test(line)) {
      break;
    }
    bodyLines.push(line);
  }
  return bodyLines.join('\n');
}

const PARAM_NAME_ALIASES = {
  hole_diameter: 'hole_diameter',
  hole_radius: 'hole_radius',
  outer_r: 'outer_radius',
  outer_radius: 'outer_radius',
  bore_r: 'bore_radius',
  bore_radius: 'bore_radius',
  module_mm: 'module',
  module: 'module',
  teeth: 'teeth',
  height: 'height',
  width: 'width',
  length: 'length',
  radius: 'radius',
  size: 'size',
  thick: 'thickness',
  thickness: 'thickness',
};

function normalizeParamId(id) {
  const key = String(id || '').trim();
  return PARAM_NAME_ALIASES[key] || key;
}

export function extractPythonNumericParams(source) {
  const parameters = {};
  const body = genStepBody(source);
  const full = String(source || '');

  for (const line of body.split('\n')) {
    const assignment = /^\s*([a-z_][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)\s*(?:#.*)?$/i.exec(line);
    if (assignment) {
      addNumberParam(parameters, normalizeParamId(assignment[1]), assignment[2]);
    }
  }

  const viewerBlock = /#\s*---\s*viewer parameters\s*---([\s\S]*?)#\s*---/i.exec(full);
  if (viewerBlock) {
    for (const line of viewerBlock[1].split('\n')) {
      const assignment = /^\s*([a-z_][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)/i.exec(line);
      if (assignment) {
        addNumberParam(parameters, normalizeParamId(assignment[1]), assignment[2]);
      }
    }
  }

  const boxMatch = /Box\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/.exec(body);
  if (boxMatch) {
    addNumberParam(parameters, 'length', boxMatch[1]);
    addNumberParam(parameters, 'width', boxMatch[2]);
    addNumberParam(parameters, 'height', boxMatch[3]);
  }

  const holeMatch = /Hole\s*\(\s*radius\s*=\s*(\d+(?:\.\d+)?)/i.exec(body)
    || /radius\s*=\s*(\d+(?:\.\d+)?)\s*,\s*depth/i.exec(body);
  if (holeMatch) {
    const radius = parseFloat(holeMatch[1]);
    addNumberParam(parameters, 'hole_diameter', radius * 2);
    addNumberParam(parameters, 'hole_radius', radius);
  }

  const cylinderMatch = /Cylinder\s*\(\s*radius\s*=\s*(\d+(?:\.\d+)?)\s*,\s*height\s*=\s*(\d+(?:\.\d+)?)/i.exec(body);
  if (cylinderMatch) {
    addNumberParam(parameters, 'radius', cylinderMatch[1]);
    addNumberParam(parameters, 'height', cylinderMatch[2]);
  }

  const teethMatch = /\bteeth\s*=\s*(\d+)/i.exec(body) || /\b(\d+)\s*[- ]?teeth/i.exec(full);
  if (teethMatch) {
    addNumberParam(parameters, 'teeth', teethMatch[1], { unit: '', minScale: 0.25, maxScale: 4 });
  }

  const moduleMatch = /\bmodule(?:_mm)?\s*=\s*(\d+(?:\.\d+)?)/i.exec(body)
    || /module\s*[:=]?\s*(\d+(?:\.\d+)?)/i.exec(full);
  if (moduleMatch) {
    addNumberParam(parameters, 'module', moduleMatch[1], { unit: 'mm', minScale: 0.25, maxScale: 4 });
  }

  return parameters;
}

export function buildStepModuleScript({ cadPath = '', parameters = {} } = {}) {
  const payload = {
    schemaVersion: 1,
    cadPath: String(cadPath || '').trim(),
    parameters,
    features: {},
    animations: [],
  };
  return `export default ${JSON.stringify(payload, null, 2)};\n`;
}

export function patchPythonParameterValues(source, parameterValues = {}) {
  const text = String(source || '');
  if (!text || !Object.keys(parameterValues).length) {
    return text;
  }

  const lines = text.split('\n');
  const genStepIdx = lines.findIndex((line) => /def\s+gen_step\s*\(/.test(line));
  if (genStepIdx < 0) {
    return text;
  }

  let bodyEnd = lines.length;
  for (let i = genStepIdx + 1; i < lines.length; i += 1) {
    if (/^(?:def |class |@)/.test(lines[i])) {
      bodyEnd = i;
      break;
    }
  }

  const replacements = new Map(
    Object.entries(parameterValues).map(([key, value]) => [
      normalizeParamId(key),
      Number(value),
    ]),
  );

  for (let i = genStepIdx + 1; i < bodyEnd; i += 1) {
    const line = lines[i];
    const match = /^(\s*)([a-z_][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)(\s*(?:#.*)?)$/i.exec(line);
    if (!match) continue;
    const [, indent, name, , suffix] = match;
    const normalized = normalizeParamId(name);
    if (!replacements.has(normalized) && !replacements.has(name)) continue;
    const nextValue = replacements.get(normalized) ?? replacements.get(name);
    if (!Number.isFinite(nextValue)) continue;
    const formatted = Number.isInteger(nextValue) ? String(nextValue) : nextValue.toFixed(2).replace(/\.?0+$/, '');
    lines[i] = `${indent}${name} = ${formatted}${suffix || ''}`;
  }

  return lines.join('\n');
}

export function viewerParametersBlock(parameters = {}) {
  const entries = Object.entries(parameters);
  if (!entries.length) return '';
  const lines = ['    # --- viewer parameters ---'];
  for (const [key, value] of entries) {
    if (!Number.isFinite(Number(value))) continue;
    const formatted = Number.isInteger(Number(value)) ? String(value) : Number(value).toFixed(2);
    lines.push(`    ${key} = ${formatted}`);
  }
  lines.push('    # ---');
  return `${lines.join('\n')}\n`;
}
