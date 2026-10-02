import * as THREE from 'three';
import { CELL_SIZE, PARCEL_SIZE, SEGMENTS } from './constants.ts';
import { tokenIdToCoordinate, parcelToWorld } from './coordinates.ts';
import { getGroundHeight, getTerrainHeight, getTerrainNormal } from './terrain.ts';
import { getVegetation } from './vegetation.ts';
import { pineGeometry, rockGeometry } from './sceneryGeometry.ts';
import { terrainMaterial } from './terrainMaterial.ts';
export function createTerrainGeometry(tokenId: number, seed: bigint): THREE.BufferGeometry {
  const c = tokenIdToCoordinate(tokenId), positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  const color = new THREE.Color();
  for (let z = 0; z <= SEGMENTS; z++) for (let x = 0; x <= SEGMENTS; x++) {
    const p = parcelToWorld(c, x * CELL_SIZE, z * CELL_SIZE), h = getTerrainHeight(p.x, p.z, seed);
    positions.push(x * CELL_SIZE, h, z * CELL_SIZE); normals.push(...getTerrainNormal(p.x, p.z, seed));
    color.setHSL(0.23 + Math.min(0.06, h / 500), 0.22, 0.28 + h / 170); colors.push(color.r, color.g, color.b);
    if (x < SEGMENTS && z < SEGMENTS) { const a = z * (SEGMENTS + 1) + x, b = a + 1, cc = a + SEGMENTS + 1, d = cc + 1; indices.push(a, cc, b, b, cc, d); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeBoundingSphere(); return geometry;
}
export interface ParcelView { group: THREE.Group; border: THREE.Line; terrain: THREE.Mesh; dispose(): void }
export function createParcel(tokenId: number, seed: bigint): ParcelView {
  const c = tokenIdToCoordinate(tokenId), origin = parcelToWorld(c), group = new THREE.Group(); group.position.set(origin.x, 0, origin.z);
  const terrain = new THREE.Mesh(createTerrainGeometry(tokenId, seed), terrainMaterial());
  terrain.userData.kind = 'procedural-terrain'; terrain.receiveShadow=true; group.add(terrain);
  const points: THREE.Vector3[] = [];
  for (let side = 0; side < 4; side++) for (let i = 0; i <= SEGMENTS; i++) {
    const t = i * CELL_SIZE, x = side === 0 ? t : side === 1 ? PARCEL_SIZE : side === 2 ? PARCEL_SIZE - t : 0, z = side === 0 ? 0 : side === 1 ? t : side === 2 ? PARCEL_SIZE : PARCEL_SIZE - t;
    points.push(new THREE.Vector3(x, getTerrainHeight(origin.x + x, origin.z + z, seed) + 0.12, z));
  }
  const border = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xd7eaba, transparent: true, opacity: 0.65 })); group.add(border);
  const decorations = getVegetation(c, seed), trees = decorations.filter(d => d.kind === 'tree'), rocks = decorations.filter(d => d.kind === 'rock');
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.32, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x66513c, roughness:1 }), trees.length);
  const crown = new THREE.InstancedMesh(pineGeometry(), new THREE.MeshStandardMaterial({ vertexColors:true, roughness: 1 }), trees.length);
  const stone = new THREE.InstancedMesh(rockGeometry(.9), new THREE.MeshStandardMaterial({ vertexColors:true, roughness: 1 }), rocks.length);
  for(const mesh of [trunk,crown,stone])mesh.userData={kind:'harvest-scenery',parcel:tokenId,resource:mesh===stone?'stone':'wood'};
  const dummy = new THREE.Object3D();
  trunk.castShadow=true;crown.castShadow=true;stone.castShadow=true;stone.receiveShadow=true;
  for (const [list, mesh, offset] of [[trees, trunk, 1.8], [trees, crown, 0], [rocks, stone, 0.4]] as const) {
    list.forEach((d, i) => { dummy.position.set(d.x - origin.x, getGroundHeight(d.x, d.z, seed) + offset * d.scale, d.z - origin.z); dummy.rotation.set(0, d.rotation, 0); dummy.scale.setScalar(d.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }); group.add(mesh);
  }
  return { group, border, terrain, dispose() { group.traverse(obj => { if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) { obj.geometry.dispose(); const materials = Array.isArray(obj.material) ? obj.material : [obj.material]; materials.forEach(m => m.dispose()); if (obj instanceof THREE.InstancedMesh) obj.dispose(); } }); group.removeFromParent(); } };
}
