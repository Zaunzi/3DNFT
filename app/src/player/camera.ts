import { PerspectiveCamera } from 'three';

export function createPlayerCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(70, aspect, 0.1, 260);
  // Match PointerLockControls: yaw around world up, then pitch, without roll.
  // XYZ would turn the initial downward pitch into a sideways tilt when facing east.
  camera.rotation.set(-0.09, -Math.PI / 2, 0, 'YXZ');
  return camera;
}
