import { PerspectiveCamera, Vector3 } from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EYE_HEIGHT, JUMP_SPEED, GRAVITY, PARCEL_SIZE, SPRINT_SPEED, WALK_SPEED, WORLD_DEPTH, WORLD_WIDTH } from '../world/constants.ts';
import { getGroundHeight } from '../world/terrain.ts';
export class Player {
  readonly controls: PointerLockControls;
  private keys = new Set<string>();
  active = false;
  private grounded = true;
  private verticalSpeed = 0;
  private jumpQueued = false;
  private dragging = false;
  private abort = new AbortController();
  readonly camera: PerspectiveCamera;
  private seed: bigint;
  constructor(camera: PerspectiveCamera, canvas: HTMLCanvasElement, seed: bigint) {
    this.camera = camera; this.seed = seed;
    this.controls = new PointerLockControls(camera, canvas);
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => { if(this.active && e.code==='Space'){e.preventDefault();if(!e.repeat&&!this.keys.has('Space')&&this.grounded)this.jumpQueued=true;this.keys.add('Space');return;} if (this.active && ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)) { this.keys.add(e.code); e.preventDefault(); } }, options);
    window.addEventListener('keyup', e => this.keys.delete(e.code), options);
    window.addEventListener('blur', () => {this.keys.clear();this.jumpQueued=false;}, options);
    this.controls.addEventListener('lock', () => { this.active = true; });
    this.controls.addEventListener('unlock', () => { this.active = false; this.keys.clear();this.jumpQueued=false; });
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
  ceiling?: (x:number,z:number,feet:number)=>number;
  get animation(): 'Idle'|'Walk'|'Run'|'Jump' {if(!this.grounded)return 'Jump';if(!this.active||!['KeyW','KeyA','KeyS','KeyD'].some(k=>this.keys.has(k)))return 'Idle';return this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?'Run':'Walk';}
  resetVertical(){this.verticalSpeed=0;this.grounded=true;this.jumpQueued=false;}
  update(dt: number) {
    const delta=Math.max(0,Math.min(dt,.05));
    if(!this.active){this.keys.clear();this.jumpQueued=false;}
    if(this.active&&this.jumpQueued&&this.grounded){this.verticalSpeed=JUMP_SPEED;this.grounded=false;}
    this.jumpQueued=false;
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
          const floor=this.surface?.(next.x,next.z,feet)??getGroundHeight(next.x,next.z,this.seed);
          if(this.grounded && feet-floor<=.65)next.y=floor+EYE_HEIGHT;
          else if(floor>feet)continue;
          if(!this.obstructed?.(next))this.camera.position.copy(next);
        }
      }
    }
    this.camera.position.x = Math.max(0.01, Math.min(WORLD_WIDTH * PARCEL_SIZE - 0.01, this.camera.position.x));
    this.camera.position.z = Math.max(0.01, Math.min(WORLD_DEPTH * PARCEL_SIZE - 0.01, this.camera.position.z));
    const p=this.camera.position,feet=p.y-EYE_HEIGHT;
    const floor=this.surface?.(p.x,p.z,feet)??getGroundHeight(p.x,p.z,this.seed);
    if(this.grounded && feet-floor>.65)this.grounded=false;
    if(this.grounded || feet<floor){p.y=floor+EYE_HEIGHT;this.verticalSpeed=0;this.grounded=true;}
    else if(this.active){
      const top=this.ceiling?.(p.x,p.z,feet)??Infinity;
      let nextFeet=feet+this.verticalSpeed*delta-.5*GRAVITY*delta*delta;
      this.verticalSpeed-=GRAVITY*delta;
      if(nextFeet+EYE_HEIGHT>top && nextFeet>feet){nextFeet=Math.max(feet,top-EYE_HEIGHT);this.verticalSpeed=0;}
      if(nextFeet<=floor){nextFeet=floor;this.verticalSpeed=0;this.grounded=true;}
      p.y=nextFeet+EYE_HEIGHT;
    }
  }
  dispose() { this.abort.abort(); this.controls.dispose(); }
}
