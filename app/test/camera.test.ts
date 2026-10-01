import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { createPlayerCamera } from '../src/player/camera.ts';

test('first-person camera starts level and stays level through pointer-lock look rotations', () => {
  const camera = createPlayerCamera(16 / 9);
  const right = () => new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  assert.ok(Math.abs(right().y) < 1e-12, 'screen horizontal must be parallel to the ground');
  const direction = camera.getWorldDirection(new Vector3());
  assert.ok(direction.x > 0.99 && direction.y < 0, 'spawn faces east and slightly down');
  // Exercise the same quaternion -> YXZ Euler -> quaternion path as PointerLockControls.
  const look = new Euler(0, 0, 0, 'YXZ').setFromQuaternion(camera.quaternion);
  assert.ok(Math.abs(look.z) < 1e-12, 'controls must not inherit roll at startup');
  for (let i = 0; i < 100; i++) {
    look.setFromQuaternion(camera.quaternion);
    look.y -= 0.1;
    look.x = Math.sin(i / 10) * 1.3;
    camera.quaternion.setFromEuler(look);
    assert.ok(Math.abs(right().y) < 1e-10, 'looking around must keep horizon level');
  }
});
