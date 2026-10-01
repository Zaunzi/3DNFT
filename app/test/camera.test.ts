import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { createPlayerCamera } from '../src/player/camera.ts';

test('first-person camera starts level and stays level through pointer-lock look rotations', () => {
  const camera = createPlayerCamera(16 / 9);
  const right = () => new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  assert.ok(Math.abs(right().y) < 1e-12, 'screen horizontal must be parallel to the ground');
  const direction = camera.getWorldDirection(new Vector3());
  assert.ok(direction.x > 0.99 && Math.abs(direction.y) < 1e-12, 'spawn faces east at eye level');
  camera.updateMatrixWorld();
  for (const z of [-15, 0, 15]) {
    const bottom = new Vector3(30, -2, z).project(camera);
    const top = new Vector3(30, 5, z).project(camera);
    assert.ok(Math.abs(top.x - bottom.x) < 1e-12, 'upright objects project vertically even at the screen edges');
  }
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
