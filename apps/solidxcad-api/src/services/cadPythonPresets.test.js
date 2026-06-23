import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectComplexCadRequest,
  detectFlowReactorRequest,
  detectGearRequest,
} from './cadPythonPresets.js';

const FLOW_REACTOR_PROMPT = [
  'Continuous flow hydrogenation reactor: 20 mm OD tube reactor 150 mm long,',
  'T-mixer inlet, helical coil section, cooling jacket — use standard engineering defaults and build it.',
].join(' ');

test('flow reactor prompt is complex but not a mechanical gear', () => {
  assert.equal(detectFlowReactorRequest(FLOW_REACTOR_PROMPT), true);
  assert.equal(detectComplexCadRequest(FLOW_REACTOR_PROMPT), true);
  assert.equal(detectGearRequest(FLOW_REACTOR_PROMPT), false);
});

test('helical gear requests still match gear detection', () => {
  assert.equal(detectGearRequest('20 tooth helical gear module 2'), true);
  assert.equal(detectGearRequest('spur gear with 24 teeth'), true);
});

test('helical coil without reactor context stays non-gear', () => {
  assert.equal(detectGearRequest('helical coil heat exchanger section'), false);
});
