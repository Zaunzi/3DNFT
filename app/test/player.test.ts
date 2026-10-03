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
    key('keyup','KeyD'); key('keydown','ShiftLeft'); const sprint=camera.position.x; player.update(.05); assert.ok(Math.abs(camera.position.x-sprint-.9)<1e-9);
    player.active=false; const paused=camera.position.x; player.update(.05); assert.equal(camera.position.x,paused);
    camera.position.set(7000,0,-20); player.update(0); assert.equal(camera.position.x,6399.99); assert.equal(camera.position.z,.01);
    events.dispatchEvent(new Event('blur')); player.active=true; const afterBlur=camera.position.x; player.update(.05); assert.equal(camera.position.x,afterBlur);
  } finally { player.dispose(); Reflect.deleteProperty(globalThis,'window'); }
});

test('Space jumps once per press, lands on raised floors, and respects ceilings and pause', () => {
  const events=new EventTarget();Object.defineProperty(globalThis,'window',{value:events,configurable:true});
  const canvas=Object.assign(new EventTarget(),{ownerDocument:new EventTarget()});
  const camera=new PerspectiveCamera();camera.position.set(2720,EYE_HEIGHT,480);
  const player=new Player(camera,canvas as unknown as HTMLCanvasElement,DEFAULT_SEED);
  let floor=0;player.surface=()=>floor;player.active=true;player.update(0);
  const key=(type:string,repeat=false)=>events.dispatchEvent(Object.assign(new Event(type),{code:'Space',repeat}));
  try {
    key('keydown');player.update(.05);assert.ok(camera.position.y>EYE_HEIGHT);
    let peak=camera.position.y;
    for(let i=0;i<60;i++){key('keydown',true);player.update(1/60);peak=Math.max(peak,camera.position.y);}
    assert.ok(peak>EYE_HEIGHT+1 && peak<EYE_HEIGHT+1.3);assert.equal(camera.position.y,EYE_HEIGHT);
    player.update(.05);assert.equal(camera.position.y,EYE_HEIGHT); // Holding Space does not auto-hop.
    key('keyup');key('keydown');for(let i=0;i<18;i++)player.update(1/60);
    floor=.5;for(let i=0;i<60;i++)player.update(1/60);assert.equal(camera.position.y,EYE_HEIGHT+.5);
    key('keyup');player.ceiling=()=>EYE_HEIGHT+.7;key('keydown');
    for(let i=0;i<30;i++){player.update(1/60);assert.ok(camera.position.y<=EYE_HEIGHT+.7+1e-9);}
    key('keyup');player.ceiling=undefined;key('keydown');player.update(.05);
    player.active=false;const paused=camera.position.y;player.update(.05);assert.equal(camera.position.y,paused);
    player.active=true;for(let i=0;i<90;i++)player.update(1/60);assert.equal(camera.position.y,EYE_HEIGHT+.5);
    player.active=false;key('keyup');key('keydown');player.update(.05);player.active=true;player.update(.05);assert.equal(camera.position.y,EYE_HEIGHT+.5);
  } finally {player.dispose();Reflect.deleteProperty(globalThis,'window');}
});
