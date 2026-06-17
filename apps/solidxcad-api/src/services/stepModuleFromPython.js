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

export function extractPythonNumericParams(source) {
  const parameters = {};
  const body = genStepBody(source);

  for (const line of body.split('\n')) {
    const assignment = /^\s*([a-z_][a-z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)\s*(?:#.*)?$/i.exec(line);
    if (assignment) {
      addNumberParam(parameters, assignment[1], assignment[2]);
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
