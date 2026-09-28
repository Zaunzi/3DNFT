import { buildingTemplates } from './buildingGeometry.ts';
import * as THREE from 'three';
import type { WorldObjectType } from './model.ts';
import { pineGeometry, rockGeometry } from '../world/sceneryGeometry.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Shared immutable geometries/materials: individual streamed objects never dispose these. */
export class ObjectRegistry {
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private definitions = new Map<WorldObjectType, { geometry: THREE.BufferGeometry; material: THREE.Material; y: number }[]>();
  readonly validPreview = new THREE.MeshBasicMaterial({ color: 0x92efbc, transparent: true, opacity: 0.48, depthWrite: false });
  readonly invalidPreview = new THREE.MeshBasicMaterial({ color: 0xff6868, transparent: true, opacity: 0.48, depthWrite: false });
  private buildings = buildingTemplates();
  constructor() {
    const material = (color: number) => { const value = new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); this.materials.push(value); return value; };
    const stone = material(0x9bafc0), wood = material(0xa58b69), leaf = material(0x4d8162);
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => { this.geometries.push(geometry); return { geometry, material, y }; };
    this.definitions.set(1, [part(new RoundedBoxGeometry(2, 2, 2, 2, .08), stone, 1)]);
    this.definitions.set(2, [part(new THREE.BoxGeometry(6, 0.5, 4), wood, 0.25)]);
    this.definitions.set(3, [part(new THREE.CylinderGeometry(.68,.76,4.6,20),stone,2.5),part(new THREE.CylinderGeometry(.8,.8,.4,20),stone,.2),part(new THREE.CylinderGeometry(.8,.8,.4,20),stone,4.8)]);
    const foliage=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),rock=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});this.materials.push(foliage,rock);
    this.definitions.set(4, [part(new THREE.CylinderGeometry(0.14, 0.3, 3.6, 10), wood, 1.8), part(pineGeometry(), foliage, 0)]);
    this.definitions.set(5, [part(rockGeometry(1.2), rock, .87)]);
  }
  create(type: WorldObjectType, preview = false) {
    const template=this.buildings.get(type);
    const group = template ? template.clone(true) : new THREE.Group();
    if(template && preview) this.setPreviewValid(group,true);
    for (const part of this.definitions.get(type) ?? []) { const mesh = new THREE.Mesh(part.geometry, preview ? this.validPreview : part.material); mesh.position.y = part.y; group.add(mesh); }
    group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=!preview;o.receiveShadow=true;}});return group;
  }
  setPreviewValid(group: THREE.Group, valid: boolean) { group.traverse(object => { if (object instanceof THREE.Mesh) object.material = valid ? this.validPreview : this.invalidPreview; }); }
  dispose() { const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();for(const g of this.buildings.values())g.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose()); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.validPreview.dispose(); this.invalidPreview.dispose(); }
}
