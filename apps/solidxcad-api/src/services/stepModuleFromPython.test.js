import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStepModuleScript,
  extractPythonNumericParams,
} from './stepModuleFromPython.js';

test('extractPythonNumericParams finds assignments and common build123d patterns', () => {
  const source = `from build123d import *

def gen_step():
    size = 30
    hole_r = 8
    with BuildPart() as bp:
        Box(size, size, size)
        Hole(radius=hole_r, depth=size + 1)
    return bp.part
`;
  const parameters = extractPythonNumericParams(source);
  assert.equal(parameters.size.defaultValue, 30);
  assert.equal(parameters.hole_r.defaultValue, 8);
});

test('buildStepModuleScript emits importable module text', () => {
  const script = buildStepModuleScript({
    cadPath: 'part_123',
    parameters: {
      size: { type: 'number', label: 'Size', defaultValue: 30, min: 1, max: 300, unit: 'mm' },
    },
  });
  assert.match(script, /^export default \{/);
  assert.match(script, /"cadPath": "part_123"/);
});
