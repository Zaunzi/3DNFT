import { PerspectiveCamera } from 'three';

export function createPlayerCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(70, aspect, 0.1, 260);
  // Match PointerLockControls: yaw around world up, then pitch, without roll.
  // Start at eye level so vertical objects also appear vertical across the screen.
  camera.rotation.set(0, -Math.PI / 2, 0, 'YXZ');
  return camera;
}
