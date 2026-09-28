import { PerspectiveCamera, Vector3 } from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EYE_HEIGHT, PARCEL_SIZE, SPRINT_SPEED, WALK_SPEED, WORLD_DEPTH, WORLD_WIDTH } from '../world/constants.ts';
import { getGroundHeight } from '../world/terrain.ts';
export class Player {
  readonly controls: PointerLockControls;
  private keys = new Set<string>();
  active = false;
  private dragging = false;
  private abort = new AbortController();
  readonly camera: PerspectiveCamera;
  private seed: bigint;
  constructor(camera: PerspectiveCamera, canvas: HTMLCanvasElement, seed: bigint) {
    this.camera = camera; this.seed = seed;
    this.controls = new PointerLockControls(camera, canvas);
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => { if (this.active && ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)) { this.keys.add(e.code); e.preventDefault(); } }, options);
    window.addEventListener('keyup', e => this.keys.delete(e.code), options);
    window.addEventListener('blur', () => this.keys.clear(), options);
    this.controls.addEventListener('lock', () => { this.active = true; });
    this.controls.addEventListener('unlock', () => { this.active = false; this.keys.clear(); });
    canvas.addEventListener('pointerdown', e => { if (this.active && !this.controls.isLocked) { this.dragging = true; canvas.setPointerCapture(e.pointerId); } }, options);
    canvas.addEventListener('pointerup', () => { this.dragging = false; }, options);
    canvas.addEventListener('pointercancel', () => { this.dragging = false; }, options);
    canvas.addEventListener('pointermove', e => {
      if (!this.dragging || this.controls.isLocked || !this.active) return;
      camera.rotation.order = 'YXZ'; camera.rotation.y -= e.movementX * 0.002;
      camera.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, camera.rotation.x - e.movementY * 0.002));
    }, options);
  }
  surface?: (x:number,z:number,feet:number)=>number;
  obstructed?: (position:Vector3)=>boolean;
  update(dt: number) {
    this.camera.updateMatrix();
    if (this.active) {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')), right = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const length = Math.hypot(forward, right) || 1, speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED) * Math.min(dt, 0.05);
      // Small steps prevent sprinting through thin modular walls. Axis checks allow wall sliding.
      const steps=Math.max(1,Math.ceil(speed/.15));
      for(let step=0;step<steps;step++){
        const before=this.camera.position.clone();
        this.controls.moveForward(forward/length*speed/steps);this.controls.moveRight(right/length*speed/steps);
        const target=this.camera.position.clone();this.camera.position.copy(before);
        for(const axis of ['x','z'] as const){const next=this.camera.position.clone();next[axis]=target[axis];
          const feet=this.camera.position.y-EYE_HEIGHT;
          next.y=(this.surface?.(next.x,next.z,feet)??getGroundHeight(next.x,next.z,this.seed))+EYE_HEIGHT;
          if(!this.obstructed?.(next))this.camera.position.copy(next);
        }
      }
    }
    this.camera.position.x = Math.max(0.01, Math.min(WORLD_WIDTH * PARCEL_SIZE - 0.01, this.camera.position.x));
    this.camera.position.z = Math.max(0.01, Math.min(WORLD_DEPTH * PARCEL_SIZE - 0.01, this.camera.position.z));
    this.camera.position.y = (this.surface?.(this.camera.position.x,this.camera.position.z,this.camera.position.y-EYE_HEIGHT)??getGroundHeight(this.camera.position.x, this.camera.position.z, this.seed)) + EYE_HEIGHT;
  }
  dispose() { this.abort.abort(); this.controls.dispose(); }
}
