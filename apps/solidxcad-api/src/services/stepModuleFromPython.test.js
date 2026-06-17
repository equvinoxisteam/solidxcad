import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStepModuleScript,
  extractPythonNumericParams,
  patchPythonParameterValues,
} from './stepModuleFromPython.js';
import { buildGearFallbackGenStep } from './cadPythonPresets.js';

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

test('extractPythonNumericParams reads gear viewer parameter block', () => {
  const source = buildGearFallbackGenStep('helical gear 24 teeth module 2.5');
  const parameters = extractPythonNumericParams(source);
  assert.equal(parameters.teeth.defaultValue, 24);
  assert.equal(parameters.module.defaultValue, 2.5);
  assert.equal(parameters.height_mm.defaultValue, 10);
});

test('patchPythonParameterValues updates gen_step assignments', () => {
  const source = buildGearFallbackGenStep('20 teeth');
  const patched = patchPythonParameterValues(source, { teeth: 30, module: 3 });
  assert.match(patched, /teeth = 30/);
  assert.match(patched, /module_mm = 3/);
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
