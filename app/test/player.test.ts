import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { Player } from '../src/player/player.ts';
import { DEFAULT_SEED, EYE_HEIGHT } from '../src/world/constants.ts';
import { getGroundHeight } from '../src/world/terrain.ts';
import { worldToParcel, coordinateToTokenId } from '../src/world/coordinates.ts';

test('WASD crosses #742 to #743, follows ground, pauses and clamps finite edges', () => {
  // Real Three.js controls with a minimal event target, without a WebGL dependency.
  const events = new EventTarget();
  Object.defineProperty(globalThis, 'window', { value: events, configurable: true });
  const canvas = Object.assign(new EventTarget(), { ownerDocument: new EventTarget() });
  const camera = new PerspectiveCamera(); camera.position.set(2720, 0, 480); camera.rotation.y = -Math.PI / 2;
  const player = new Player(camera, canvas as unknown as HTMLCanvasElement, DEFAULT_SEED);
  const key = (type: string, code: string) => events.dispatchEvent(Object.assign(new Event(type), { code }));
  try {
    player.active = true; key('keydown','KeyW');
    for (let i=0;i<250;i++) player.update(1/60);
    const c=worldToParcel(camera.position.x,camera.position.z); assert.equal(coordinateToTokenId(c.x,c.z),743);
    assert.equal(camera.position.y,getGroundHeight(camera.position.x,camera.position.z,DEFAULT_SEED)+EYE_HEIGHT);
    key('keyup','KeyW'); const x=camera.position.x; player.update(1/60); assert.equal(camera.position.x,x);
    key('keydown','KeyW'); key('keydown','KeyD'); const start=camera.position.clone(); player.update(.05);
    assert.ok(Math.abs(Math.hypot(camera.position.x-start.x,camera.position.z-start.z)-.4)<1e-9);
    key('keyup','KeyD'); key('keydown','ShiftLeft'); const sprint=camera.position.x; player.update(.05); assert.ok(Math.abs(camera.position.x-sprint-1.1)<1e-9);
    player.active=false; const paused=camera.position.x; player.update(.05); assert.equal(camera.position.x,paused);
    camera.position.set(7000,0,-20); player.update(0); assert.equal(camera.position.x,6399.99); assert.equal(camera.position.z,.01);
    events.dispatchEvent(new Event('blur')); player.active=true; const afterBlur=camera.position.x; player.update(.05); assert.equal(camera.position.x,afterBlur);
  } finally { player.dispose(); Reflect.deleteProperty(globalThis,'window'); }
});
