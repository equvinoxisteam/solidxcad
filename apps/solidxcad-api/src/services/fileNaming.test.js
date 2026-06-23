import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveFriendlyFileBase, resolveUniqueFileBase } from './fileNaming.js';

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

test('deriveFriendlyFileBase names flow reactors without helical gear token', () => {
  const base = deriveFriendlyFileBase(
    'Continuous flow hydrogenation reactor: 20 mm OD tube, T-mixer, helical coil, cooling jacket',
  );
  assert.match(base, /20mm/);
  assert.match(base, /reactor/);
  assert.doesNotMatch(base, /helical/);
});

test('resolveUniqueFileBase avoids basename collisions', () => {
  const files = [
    { name: 'custom_part.step', s3Key: 'u/p/models/custom_part.step' },
  ];
  assert.equal(resolveUniqueFileBase('custom_part', files, 'models'), 'custom_part_1');
  assert.equal(resolveUniqueFileBase('new_bracket', files, 'models'), 'new_bracket');
});
