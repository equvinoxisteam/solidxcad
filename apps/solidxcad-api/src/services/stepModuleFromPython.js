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
  let text = String(source || '');
  if (!text || !Object.keys(parameterValues).length) {
    return text;
  }

  const replacements = new Map(
    Object.entries(parameterValues).map(([key, value]) => [
      normalizeParamId(key),
      Number(value),
    ]),
  );

  const getValue = (id) => {
    const normalized = normalizeParamId(id);
    if (replacements.has(normalized)) return replacements.get(normalized);
    if (replacements.has(id)) return replacements.get(id);
    return undefined;
  };

  const formatNum = (value) => (
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
  );

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

  for (let i = genStepIdx + 1; i < bodyEnd; i += 1) {
    let line = lines[i];

    const assignment = /^(\s*)([a-z_][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)(\s*(?:#.*)?)$/i.exec(line);
    if (assignment) {
      const [, indent, name, , suffix] = assignment;
      const nextValue = getValue(name);
      if (Number.isFinite(nextValue)) {
        lines[i] = `${indent}${name} = ${formatNum(nextValue)}${suffix || ''}`;
        continue;
      }
    }

    const length = getValue('length');
    const width = getValue('width');
    const height = getValue('height');
    if (length != null && width != null && height != null) {
      const boxMatch = /^(\s*)Box\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/.exec(line);
      if (boxMatch) {
        lines[i] = `${boxMatch[1]}Box(${formatNum(length)}, ${formatNum(width)}, ${formatNum(height)})`;
        continue;
      }
    }

    const holeRadius = getValue('hole_radius') ?? (
      getValue('hole_diameter') != null ? getValue('hole_diameter') / 2 : undefined
    );
    if (holeRadius != null) {
      const holeMatch = /^(\s*)Hole\s*\(\s*radius\s*=\s*(\d+(?:\.\d+)?)/i.exec(line);
      if (holeMatch) {
        lines[i] = line.replace(
          /radius\s*=\s*\d+(?:\.\d+)?/i,
          `radius=${formatNum(holeRadius)}`,
        );
        continue;
      }
    }

    const radius = getValue('radius');
    const cylHeight = getValue('height');
    if (radius != null && cylHeight != null) {
      const cylMatch = /^(\s*)Cylinder\s*\(\s*radius\s*=\s*(\d+(?:\.\d+)?)\s*,\s*height\s*=\s*(\d+(?:\.\d+)?)/i.exec(line);
      if (cylMatch) {
        lines[i] = `${cylMatch[1]}Cylinder(radius=${formatNum(radius)}, height=${formatNum(cylHeight)})`;
      }
    }
  }

  text = lines.join('\n');

  const viewerBlockRe = /#\s*---\s*viewer parameters\s*---[\s\S]*?#\s*---/i;
  if (replacements.size && viewerBlockRe.test(text)) {
    const oldBlock = viewerBlockRe.exec(text)?.[0] || '';
    const nameByNormalized = new Map();
    for (const line of oldBlock.split('\n')) {
      const match = /^\s*([a-z_][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)/i.exec(line);
      if (match) {
        nameByNormalized.set(normalizeParamId(match[1]), match[1]);
      }
    }
    const blockValues = {};
    for (const [key, value] of replacements.entries()) {
      if (!Number.isFinite(value)) continue;
      const writeName = nameByNormalized.get(key) || key;
      blockValues[writeName] = value;
    }
    text = text.replace(viewerBlockRe, viewerParametersBlock(blockValues).trim());
  }

  return text;
}

export function injectViewerParametersIntoGenStep(source) {
  const text = String(source || '');
  if (!/def\s+gen_step\s*\(/i.test(text)) return text;
  if (/#\s*---\s*viewer parameters\s*---/i.test(text)) return text;

  const params = extractPythonNumericParams(text);
  const values = Object.fromEntries(
    Object.entries(params).map(([key, meta]) => [key, meta.defaultValue]),
  );
  if (!Object.keys(values).length) return text;

  const lines = text.split('\n');
  const genStepIdx = lines.findIndex((line) => /def\s+gen_step\s*\(/.test(line));
  if (genStepIdx < 0) return text;

  const blockLines = viewerParametersBlock(values).trimEnd().split('\n');
  lines.splice(genStepIdx + 1, 0, ...blockLines);
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
