import * as THREE from 'three';
import type { WorldObjectType } from './model.ts';

/** Shared immutable geometries/materials: individual streamed objects never dispose these. */
export class ObjectRegistry {
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private definitions = new Map<WorldObjectType, { geometry: THREE.BufferGeometry; material: THREE.Material; y: number }[]>();
  readonly validPreview = new THREE.MeshBasicMaterial({ color: 0x92efbc, transparent: true, opacity: 0.48, depthWrite: false });
  readonly invalidPreview = new THREE.MeshBasicMaterial({ color: 0xff6868, transparent: true, opacity: 0.48, depthWrite: false });
  constructor() {
    const material = (color: number) => { const value = new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); this.materials.push(value); return value; };
    const stone = material(0x9bafc0), wood = material(0xa58b69), leaf = material(0x4d8162);
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => { this.geometries.push(geometry); return { geometry, material, y }; };
    this.definitions.set(1, [part(new THREE.BoxGeometry(2, 2, 2), stone, 1)]);
    this.definitions.set(2, [part(new THREE.BoxGeometry(6, 0.5, 4), wood, 0.25)]);
    this.definitions.set(3, [part(new THREE.CylinderGeometry(0.8, 0.8, 5, 10), stone, 2.5)]);
    this.definitions.set(4, [part(new THREE.CylinderGeometry(0.22, 0.3, 2, 6), wood, 1), part(new THREE.ConeGeometry(2, 4, 8), leaf, 4)]);
    this.definitions.set(5, [part(new THREE.IcosahedronGeometry(1.2, 0), stone, 1.2)]);
  }
  create(type: WorldObjectType, preview = false) {
    const group = new THREE.Group();
    for (const part of this.definitions.get(type)!) { const mesh = new THREE.Mesh(part.geometry, preview ? this.validPreview : part.material); mesh.position.y = part.y; group.add(mesh); }
    return group;
  }
  setPreviewValid(group: THREE.Group, valid: boolean) { group.traverse(object => { if (object instanceof THREE.Mesh) object.material = valid ? this.validPreview : this.invalidPreview; }); }
  dispose() { this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.validPreview.dispose(); this.invalidPreview.dispose(); }
}
