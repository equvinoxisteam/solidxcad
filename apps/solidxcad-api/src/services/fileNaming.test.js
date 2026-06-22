import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveFriendlyFileBase } from './fileNaming.js';

test('deriveFriendlyFileBase builds readable part names', () => {
  assert.equal(
    deriveFriendlyFileBase('30mm cube with 4× M3 holes'),
    '30mm_cube_m3_holes',
  );
  assert.equal(
    deriveFriendlyFileBase('Make a 20mm cube with 2mm fillets on all edges'),
    '20mm_cube_filleted',
  );
});

test('deriveFriendlyFileBase tags assemblies and robots', () => {
  assert.match(
    deriveFriendlyFileBase('Assembly: mount plate with screws', { isAssembly: true }),
    /assembly/,
  );
  assert.equal(
    deriveFriendlyFileBase('6 DOF robot arm with gripper', { skill: 'urdf' }),
    'robot_arm_gripper',
  );
});
