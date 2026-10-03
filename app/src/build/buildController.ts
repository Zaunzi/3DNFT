import { snapBuildCoordinate, snapStructure, placementBaseHeight } from '../objects/building.ts';
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
  cost?:(type:number)=>string;
  modular?: boolean;
  lockedDoor?: {createPreview():THREE.Group; place(token:number,t:LocalTransform):Promise<void>};
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
  private type: WorldObjectType | 6 | 13 = 4;
  private rotation = 0;
  private selecting = false;
  private preview: THREE.Group;
  private candidate: (LocalTransform & {y?:number}) | null = null;
  private selected: { tokenId: number; objectId: number; kind:'primitive'|'portal' } | null = null;
  private highlight = new THREE.BoxHelper(new THREE.Object3D(), 0xffe7a0);
  constructor(options: BuildOptions) {
    this.options = options;
    this.preview = options.registry.create(4, true); this.preview.visible = false; options.scene.add(this.preview);
    this.highlight.visible = false; options.scene.add(this.highlight);
    this.panel = document.createElement('section'); this.panel.className = 'build-panel'; this.panel.hidden = true;
    this.panel.innerHTML = `<div class="build-heading"><div><div class="menu-kicker">PARCEL WORKSHOP</div><h2>Build your place.</h2></div><button id="close-build" aria-label="Exit build mode">×</button></div><div class="object-types"><button id="select-build-object">Select / Remove</button>${Object.entries(OBJECT_TYPES).filter(([id])=>Number(id)>=4&&(options.modular||Number(id)<7)).map(([id, def]) => `<button data-object="${id}">${Number(id)<6?'['+id+'] ':''}${def.name}</button>`).join('')}</div><p class="build-help">R rotate · Click to place · Select / Remove to edit<br>Delete remove · B exit · Esc clear selection</p><p id="build-status" role="status"></p><button id="remove-object">Remove object</button>`;
    document.getElementById('app')!.append(this.panel);
    if(options.portals){this.panel.querySelector('.object-types')!.insertAdjacentHTML('beforeend','<button data-object="6">[6] Portal</button>');const label=document.createElement('label');label.id='portal-destination-label';label.hidden=true;label.innerHTML='Destination token ID <input id="portal-destination" type="number" min="0" max="4999" placeholder="Minted parcel ID">';this.panel.append(label);const hint=document.createElement('small');hint.textContent='Destination must be minted. Portal Cores are not required or consumed.';label.append(hint);}
    if(options.modular){
      this.panel.querySelector('.object-types')!.insertAdjacentHTML('beforeend','<button data-object="13">Locked door · Key</button>');
      const label=document.createElement('label');label.innerHTML='Manual base height (optional) <input id="build-height" type="number" step="0.1" min="-320" max="320" placeholder="Auto: local ground">';this.panel.append(label);
      for(const axis of ['x','z']){const row=document.createElement('label');row.innerHTML=`Local ${axis.toUpperCase()} (meters, blank = cursor) <input id="build-${axis}" type="number" min="0" max="64" step="0.5">`;this.panel.append(row);}
      const note=document.createElement('p');note.className='build-help';note.textContent='4m modules · 0.5m grid · 90° turns. Walls snap to foundation edges; roofs snap to wall layouts. Manual X/Z disables snapping. Unsnapped pieces follow local ground; only manual height overrides this. Place walls at foundation edges; doorway and locked door at the same point. Placement takes priority over existing pieces. Leave manual height blank for automatic grounding. Lanterns are scenery, not ERC-1155 items.';this.panel.append(note);
    }
    const palette=this.panel.querySelector('.object-types')!;
    for(const [title, ids] of [['Structure',[7,8,9,10,11,14,15]],['Scenery',[4,5,12]],['Interactive',[6,13]]] as const){
      const group=document.createElement('div');group.className='build-group';
      const heading=document.createElement('h3');heading.textContent=title;group.append(heading);
      for(const id of ids){const button=palette.querySelector(`[data-object="${id}"]`);if(button)group.append(button);}
      if(group.children.length>1)palette.append(group);
    }
    const advanced=document.createElement('details');advanced.className='build-advanced';
    const summary=document.createElement('summary');summary.textContent='Precise placement';advanced.append(summary);
    for(const input of Array.from(this.panel.querySelectorAll<HTMLInputElement>('#build-height,#build-x,#build-z')))advanced.append(input.parentElement!);
    if(advanced.children.length>1){const notes=this.panel.querySelectorAll('.build-help');if(notes.length>1)advanced.append(notes[notes.length-1]);this.panel.append(advanced);}
    const removal=this.panel.querySelector<HTMLButtonElement>('#remove-object')!;removal.disabled=true;
    const actions=document.createElement('div');actions.className='build-actions';actions.append(removal);this.panel.append(actions);
    const signal = this.abort.signal;
    this.panel.querySelector('#select-build-object')!.addEventListener('click',()=>this.openRemoval(),{signal});
    this.panel.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => button.addEventListener('click', () => this.choose(Number(button.dataset.object) as WorldObjectType|6|13), { signal }));
    this.panel.querySelector('#remove-object')!.addEventListener('click', () => { void this.remove(); }, { signal });
    this.panel.querySelector('#close-build')!.addEventListener('click', () => this.toggle(), { signal });
    window.addEventListener('keydown', event => {
      if (event.repeat || (event.target instanceof Element && event.target.matches('input,textarea,select'))) return;
      if (event.code === 'KeyB') { event.preventDefault(); this.toggle(); return; }
      if (!this.active) return;
      if (event.code === 'KeyR') this.rotation = (this.rotation + (this.type>=7?9000:1500)) % 36000;
      if (/^Digit[4-6]$/.test(event.code)) this.choose(Number(event.code.slice(-1)) as WorldObjectType|6|13);
      if (event.code === 'Delete') { event.preventDefault(); void this.remove(); }
      if (event.code === 'Escape') this.selected = null;
    }, { signal });
    options.canvas.addEventListener('pointermove', event => {
      const rect = options.canvas.getBoundingClientRect();
      this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); this.hasPointer = true;
    }, { signal });
    options.canvas.addEventListener('pointerleave', () => { this.hasPointer = false; }, { signal });
    options.canvas.addEventListener('click', event => { if (event.button === 0) void this.click(); }, { signal });
    this.choose(options.modular ? 7 : 4);
  }
  private status(message: string) { this.panel.querySelector('#build-status')!.textContent = message+(this.options.cost?` · Cost: ${this.options.cost(this.type)} · No removal refunds`: ''); }
  toggle() {
    if (this.pending) return;
    if (!this.active && !this.options.canBuild(this.options.currentToken())) { this.options.report('Connect the parcel owner on the configured chain to build here.'); return; }
    this.setActive(!this.active);
  }
  setActive(active: boolean) {
    this.active = active; this.panel.hidden = !active; this.preview.visible = false; this.highlight.visible = false; this.candidate = null; this.selected = null;
    this.options.canvas.style.cursor = active ? 'crosshair' : ''; this.options.onMode(active);
  }
  private choose(type: WorldObjectType | 6 | 13) {
    if (this.pending || type < 4) return;
    if(type===6&&!this.options.portals)return;
    if(type>=7&&!this.options.modular)return;
    if(type===13&&!this.options.lockedDoor)return;
    if(type>=7)this.rotation=Math.round(this.rotation/9000)*9000%36000;
    this.selecting=false;this.panel.querySelector('#select-build-object')!.classList.remove('chosen');
    this.releasePreview();
    this.type = type; this.selected = null; this.preview = type===13?this.options.lockedDoor!.createPreview():type===6?this.options.portals!.createPreview():this.options.registry.create(type, true); this.preview.visible = false; this.options.scene.add(this.preview);
    const destination=this.panel.querySelector<HTMLElement>('#portal-destination-label');if(destination)destination.hidden=type!==6;
    if(type===13){this.preview.userData.ownedPreview=true;this.preview.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});this.options.registry.setPreviewValid(this.preview,true);}
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
      if (object) { this.highlight.setFromObject(object); this.highlight.visible = true; this.status(`Selected object #${this.selected.objectId} · Remove object or Delete · Esc deselect`); return; }
      this.selected = null;
    }
    if(this.selecting){this.status('Select / Remove: click an object, then Remove object or Delete. Choose a piece to resume placement.');return;}
    this.status(`${this.type===13?'Locked door':this.type===6?'Portal':OBJECT_TYPES[this.type].name} · ${(this.rotation / 100).toFixed(0)}° · ${this.type===6?`${o.portals!.count(token)}/16 portals`:`${entry.objects.length}/${MAX_OBJECTS} objects`}`);
    if (!this.hasPointer) return;
    o.camera.updateMatrixWorld(); o.scene.updateMatrixWorld(true); this.ray.setFromCamera(this.pointer, o.camera);
    // Only explicitly marked terrain meshes are placement surfaces.
    const terrains = [...o.world.parcels.values()].map(parcel => parcel.terrain);
    const hit = this.ray.intersectObjects(this.type>=7?[...terrains,...o.layer.roots()]:terrains, true)[0];
    if (!hit) return;
    const placement = { objectType: this.type, ...worldToObjectPosition(token, hit.point.x, hit.point.z), rotation: this.rotation };
    if(this.type>=7){for(const axis of ['x','z'] as const){const input=this.panel.querySelector<HTMLInputElement>(`#build-${axis}`);placement[axis]=snapBuildCoordinate(input?.value.trim()?Number(input.value)*100:placement[axis]);}}
    const manualXZ=['x','z'].some(axis=>this.panel.querySelector<HTMLInputElement>(`#build-${axis}`)?.value.trim());
    let hitRoot:THREE.Object3D|null=hit.object;
    while(hitRoot&&hitRoot.userData.kind!=='persistent')hitRoot=hitRoot.parent;
    const target=hitRoot?.userData.tokenId===token?{id:hitRoot.userData.objectId as number,hitY:Math.round(hit.point.y*100)}:undefined;
    const snapped=manualXZ?null:snapStructure(this.type,placement.x,placement.z,entry.objects,target);
    if(snapped){placement.x=snapped.x;placement.z=snapped.z;placement.rotation=snapped.rotation;}
    const world = objectToWorldPosition(token, placement);
    const heightInput=this.panel.querySelector<HTMLInputElement>('#build-height');
    const ground=getGroundHeight(world.x,world.z,o.world.seed);
    const baseY=placementBaseHeight(ground,heightInput?.value??'',snapped?.y,this.type===12?o.layer.floorHeight(world.x,world.z,hit.point.y):undefined);
    const doorOffset=this.type===13&&(snapped||heightInput?.value.trim())?.5:0;
    const modularPlacement={...placement,...(this.type>=7?{y:Math.round((baseY+doorOffset)*100)}:{})};
    this.preview.position.set(world.x, this.type===13?baseY+doorOffset:this.type>=7?baseY:getGroundHeight(world.x, world.z, o.world.seed), world.z); this.preview.rotation.y = placement.rotation / 100 * Math.PI / 180; this.preview.visible = true;
    let valid = this.type===6?o.portals!.count(token)<16:entry.objects.length < MAX_OBJECTS;
    try { if(this.type===6)validatePortal({...placement,destinationTokenId:this.destination()});else if(this.type===13){validatePortal({...placement,destinationTokenId:token});if(!Number.isInteger(modularPlacement.y)||modularPlacement.y! < -32000||modularPlacement.y!>32000)throw new Error('Invalid door height');}else validatePlacement({...modularPlacement,objectType:this.type}); } catch { valid = false; }
    o.registry.setPreviewValid(this.preview, valid);
    if (valid) {this.candidate = modularPlacement;if(snapped)this.status(`${this.type===13?'Locked door snapped to doorway':this.type===15?'Staircase snapped to upper floor':this.type===14?'Stairs snapped to foundation entrance':this.type===7?'Foundation snapped flush':this.type===11?'Roof snapped to structure':'Wall snapped to structure'} - click to place`);}
    else this.status('Invalid placement: keep the full object inside this parcel (maximum 128 objects).');
  }
  private async click() {
    if (!this.active || this.pending || !this.hasPointer) return;
    const o = this.options; this.update(); if (!this.active) return;
    o.camera.updateMatrixWorld();o.scene.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer, o.camera);
    const hit = this.ray.intersectObjects([...o.layer.roots(),...(o.portals?.roots()??[])], true)[0];
    const ground = this.ray.intersectObjects([...o.world.parcels.values()].map(parcel => parcel.terrain), false)[0];
    if (this.selecting && hit && (!ground || hit.distance <= ground.distance + 0.02)) {
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.kind !== 'persistent' && object.userData.kind !== 'portal') object = object.parent;
      const tokenId=object?.userData.kind==='portal'?object.userData.entity.parcelTokenId:object?.userData.tokenId;
      if (object && tokenId === o.currentToken() && o.canBuild(tokenId)) {
        this.selected = { tokenId, objectId: object.userData.kind==='portal'?object.userData.entity.id:object.userData.objectId, kind:object.userData.kind==='portal'?'portal':'primitive' }; return;
      }
      o.report('Walk into a parcel you own to manage its objects.'); return;
    }
    if (this.selecting) { this.selected = null; return; }
    if (!this.candidate) return;
    const token = o.currentToken(), placement = { ...this.candidate };
    if(this.type===13){await this.save(token,()=>o.lockedDoor!.place(token,placement));}
    else if(this.type===6){const destinationTokenId=this.destination();await this.save(token,()=>o.portals!.place(token,{...placement,destinationTokenId}));}
    else {const objectType=this.type;await this.save(token, () => o.writer.addObject(BigInt(token), {...placement,objectType}));}
  }
  private openRemoval() {
    if(this.pending)return;
    this.selecting=true;this.preview.visible=false;this.candidate=null;
    this.panel.querySelectorAll('[data-object]').forEach(b=>b.classList.remove('chosen'));
    this.panel.querySelector('#select-build-object')!.classList.add('chosen');
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
  private releasePreview(){if(this.preview.userData.ownedPreview)this.preview.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.preview.removeFromParent();}
  dispose() { this.abort.abort(); this.releasePreview(); this.highlight.removeFromParent(); this.highlight.geometry.dispose(); (this.highlight.material as THREE.Material).dispose(); this.panel.remove(); }
}

