import * as THREE from 'three';
import type { WorldManager } from '../world/worldManager.ts';
import type { ParcelStateWriter } from '../blockchain/parcelState.ts';
import { OBJECT_TYPES, MAX_OBJECTS, objectToWorldPosition, validatePlacement, worldToObjectPosition, type ObjectPlacement, type WorldObjectType } from '../objects/model.ts';
import type { ObjectRegistry } from '../objects/registry.ts';
import type { PersistentObjectLayer } from '../objects/persistentLayer.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { validatePortal, type LocalTransform } from '../items/model.ts';

interface BuildOptions {
  canvas: HTMLCanvasElement; camera: THREE.Camera; scene: THREE.Scene; world: WorldManager;
  layer: PersistentObjectLayer; registry: ObjectRegistry; writer: ParcelStateWriter;
  currentToken(): number; canBuild(tokenId: number): boolean;
  onMode(active: boolean): void; report(message: string): void;
  portals?: { createPreview():THREE.Group; roots():THREE.Object3D[]; find(tokenId:number,id:number):THREE.Object3D|undefined; count(tokenId:number):number; place(tokenId:number,placement:LocalTransform&{destinationTokenId:number}):Promise<void>; remove(tokenId:number,id:number):Promise<void> };
}
export class BuildController {
  active = false;
  pending = false;
  private options: BuildOptions;
  private abort = new AbortController();
  private panel: HTMLElement;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hasPointer = false;
  private type: WorldObjectType | 6 = 1;
  private rotation = 0;
  private preview: THREE.Group;
  private candidate: LocalTransform | null = null;
  private selected: { tokenId: number; objectId: number; kind:'primitive'|'portal' } | null = null;
  private highlight = new THREE.BoxHelper(new THREE.Object3D(), 0xffe7a0);
  constructor(options: BuildOptions) {
    this.options = options;
    this.preview = options.registry.create(1, true); this.preview.visible = false; options.scene.add(this.preview);
    this.highlight.visible = false; options.scene.add(this.highlight);
    this.panel = document.createElement('section'); this.panel.className = 'build-panel'; this.panel.hidden = true;
    this.panel.innerHTML = `<div class="eyebrow">BUILD MODE · TERRAIN ANCHORED</div><div class="object-types">${Object.entries(OBJECT_TYPES).map(([id, def]) => `<button data-object="${id}">[${id}] ${def.name}</button>`).join('')}</div><p class="build-help">R rotate · Click terrain to place · Click object to select<br>Delete remove · B exit · Esc clear selection</p><p id="build-status" role="status"></p><button id="remove-object" disabled>Remove selected object</button>`;
    document.getElementById('app')!.append(this.panel);
    if(options.portals){this.panel.querySelector('.object-types')!.insertAdjacentHTML('beforeend','<button data-object="6">[6] Portal</button>');const label=document.createElement('label');label.id='portal-destination-label';label.hidden=true;label.innerHTML='Destination token ID <input id="portal-destination" type="number" min="0" max="4999" placeholder="Minted parcel ID">';this.panel.append(label);const hint=document.createElement('small');hint.textContent='Destination must be minted. Portal Cores are not required or consumed.';label.append(hint);}
    const signal = this.abort.signal;
    this.panel.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => button.addEventListener('click', () => this.choose(Number(button.dataset.object) as WorldObjectType|6), { signal }));
    this.panel.querySelector('#remove-object')!.addEventListener('click', () => { void this.remove(); }, { signal });
    window.addEventListener('keydown', event => {
      if (event.repeat || (event.target instanceof Element && event.target.matches('input,textarea,select'))) return;
      if (event.code === 'KeyB') { event.preventDefault(); this.toggle(); return; }
      if (!this.active) return;
      if (event.code === 'KeyR') this.rotation = (this.rotation + 1500) % 36000;
      if (/^Digit[1-6]$/.test(event.code)) this.choose(Number(event.code.slice(-1)) as WorldObjectType|6);
      if (event.code === 'Delete') { event.preventDefault(); void this.remove(); }
      if (event.code === 'Escape') this.selected = null;
    }, { signal });
    options.canvas.addEventListener('pointermove', event => {
      const rect = options.canvas.getBoundingClientRect();
      this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); this.hasPointer = true;
    }, { signal });
    options.canvas.addEventListener('pointerleave', () => { this.hasPointer = false; }, { signal });
    options.canvas.addEventListener('click', event => { if (event.button === 0) void this.click(); }, { signal });
    this.choose(1);
  }
  private status(message: string) { this.panel.querySelector('#build-status')!.textContent = message; }
  toggle() {
    if (this.pending) return;
    if (!this.active && !this.options.canBuild(this.options.currentToken())) { this.options.report('Connect the parcel owner on the configured chain to build here.'); return; }
    this.setActive(!this.active);
  }
  setActive(active: boolean) {
    this.active = active; this.panel.hidden = !active; this.preview.visible = false; this.highlight.visible = false; this.candidate = null; this.selected = null;
    this.options.canvas.style.cursor = active ? 'crosshair' : ''; this.options.onMode(active);
  }
  private choose(type: WorldObjectType | 6) {
    if (this.pending) return;
    if(type===6&&!this.options.portals)return;
    this.type = type; this.selected = null; this.preview.removeFromParent(); this.preview = type===6?this.options.portals!.createPreview():this.options.registry.create(type, true); this.preview.visible = false; this.options.scene.add(this.preview);
    const destination=this.panel.querySelector<HTMLElement>('#portal-destination-label');if(destination)destination.hidden=type!==6;
    this.panel.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => button.classList.toggle('chosen', Number(button.dataset.object) === type));
  }
  update() {
    if (!this.active) return;
    const o = this.options, token = o.currentToken();
    if (!o.canBuild(token)) { this.setActive(false); o.report('Build permissions changed. Reconnect or return to a parcel you own.'); return; }
    this.candidate = null; this.preview.visible = false; this.highlight.visible = false;
    (this.panel.querySelector('#remove-object') as HTMLButtonElement).disabled = !this.selected || this.pending;
    if (this.pending) { this.status('Saving… approve the wallet request if prompted, then wait for confirmation.'); return; }
    const entry = o.layer.parcels.get(token);
    if (!entry?.ready) { this.status('Loading persistent state… use Refresh state if a read failed.'); return; }
    if (this.selected) {
      const object = this.selected.kind==='portal'?o.portals?.find(this.selected.tokenId,this.selected.objectId):o.layer.find(this.selected.tokenId, this.selected.objectId);
      if (object) { this.highlight.setFromObject(object); this.highlight.visible = true; this.status(`Selected object #${this.selected.objectId} · Delete to remove · Esc deselect`); return; }
      this.selected = null;
    }
    this.status(`${this.type===6?'Portal':OBJECT_TYPES[this.type].name} · ${(this.rotation / 100).toFixed(0)}° · ${this.type===6?`${o.portals!.count(token)}/16 portals`:`${entry.objects.length}/${MAX_OBJECTS} objects`}`);
    if (!this.hasPointer) return;
    o.camera.updateMatrixWorld(); o.scene.updateMatrixWorld(true); this.ray.setFromCamera(this.pointer, o.camera);
    // Only explicitly marked terrain meshes are placement surfaces.
    const terrains = [...o.world.parcels.values()].map(parcel => parcel.terrain);
    const hit = this.ray.intersectObjects(terrains, false)[0];
    if (!hit) return;
    const placement = { objectType: this.type, ...worldToObjectPosition(token, hit.point.x, hit.point.z), rotation: this.rotation };
    const world = objectToWorldPosition(token, placement);
    this.preview.position.set(world.x, getGroundHeight(world.x, world.z, o.world.seed), world.z); this.preview.rotation.y = this.rotation / 100 * Math.PI / 180; this.preview.visible = true;
    let valid = this.type===6?o.portals!.count(token)<16:entry.objects.length < MAX_OBJECTS;
    try { if(this.type===6)validatePortal({...placement,destinationTokenId:this.destination()});else validatePlacement({...placement,objectType:this.type}); } catch { valid = false; }
    o.registry.setPreviewValid(this.preview, valid);
    if (valid) this.candidate = placement;
    else this.status('Invalid placement: keep the full object inside this parcel (maximum 128 objects).');
  }
  private async click() {
    if (!this.active || this.pending || !this.hasPointer) return;
    const o = this.options; this.update(); if (!this.active) return;
    this.ray.setFromCamera(this.pointer, o.camera);
    const hit = this.ray.intersectObjects([...o.layer.roots(),...(o.portals?.roots()??[])], true)[0];
    const ground = this.ray.intersectObjects([...o.world.parcels.values()].map(parcel => parcel.terrain), false)[0];
    if (hit && (!ground || hit.distance <= ground.distance + 0.02)) {
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.kind !== 'persistent' && object.userData.kind !== 'portal') object = object.parent;
      const tokenId=object?.userData.kind==='portal'?object.userData.entity.parcelTokenId:object?.userData.tokenId;
      if (object && tokenId === o.currentToken() && o.canBuild(tokenId)) {
        this.selected = { tokenId, objectId: object.userData.kind==='portal'?object.userData.entity.id:object.userData.objectId, kind:object.userData.kind==='portal'?'portal':'primitive' }; return;
      }
      o.report('Walk into a parcel you own to manage its objects.'); return;
    }
    if (this.selected) { this.selected = null; return; }
    if (!this.candidate) return;
    const token = o.currentToken(), placement = { ...this.candidate };
    if(this.type===6){const destinationTokenId=this.destination();await this.save(token,()=>o.portals!.place(token,{...placement,destinationTokenId}));}
    else {const objectType=this.type;await this.save(token, () => o.writer.addObject(BigInt(token), {...placement,objectType}));}
  }
  private async remove() {
    if (!this.active || this.pending || !this.selected) return;
    const { tokenId, objectId, kind } = this.selected;
    if (tokenId !== this.options.currentToken() || !this.options.canBuild(tokenId)) return;
    await this.save(tokenId, () => kind==='portal'?this.options.portals!.remove(tokenId,objectId):this.options.writer.removeObject(BigInt(tokenId), objectId));
  }
  private destination(){const value=(this.panel.querySelector('#portal-destination')as HTMLInputElement).value;if(!/^\d+$/.test(value))throw new Error('Enter a destination token ID');return Number(value);}
  private async save(tokenId: number, action: () => Promise<void>) {
    this.pending = true; this.selected = null;
    try { await action(); await this.options.layer.refresh(tokenId); this.options.report('Object change confirmed.'); }
    catch (error) { this.options.report(error instanceof Error ? error.message.slice(0, 240) : String(error)); }
    finally { this.pending = false; }
  }
  dispose() { this.abort.abort(); this.preview.removeFromParent(); this.highlight.removeFromParent(); this.highlight.geometry.dispose(); (this.highlight.material as THREE.Material).dispose(); this.panel.remove(); }
}

