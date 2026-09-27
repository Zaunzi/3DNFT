import { CELL_SIZE } from './constants.ts';
import { perlin, seed32 } from './noise.ts';
const seeds = new Map<bigint, number>();
function folded(seed: bigint) { let s = seeds.get(seed); if (s === undefined) { s = seed32(seed); seeds.set(seed, s); } return s; }
export function getTerrainHeight(x: number, z: number, seed: bigint): number {
  const s = folded(seed);
  return 7 + perlin(x / 190, z / 190, s) * 26 + perlin(x / 65, z / 65, s ^ 197) * 7 + perlin(x / 23, z / 23, s ^ 911) * 1.5;
}
export function getTerrainNormal(x: number, z: number, seed: bigint): [number, number, number] {
  const dx = getTerrainHeight(x - 0.5, z, seed) - getTerrainHeight(x + 0.5, z, seed);
  const dz = getTerrainHeight(x, z - 0.5, seed) - getTerrainHeight(x, z + 0.5, seed);
  const length = Math.hypot(dx, 1, dz); return [dx / length, 1 / length, dz / length];
}
// Piecewise planar interpolation matches the mesh's a-c-b / b-c-d triangles.
export function getGroundHeight(x: number, z: number, seed: bigint): number {
  const gx = Math.floor(x / CELL_SIZE) * CELL_SIZE, gz = Math.floor(z / CELL_SIZE) * CELL_SIZE;
  const u = (x - gx) / CELL_SIZE, v = (z - gz) / CELL_SIZE;
  const a = getTerrainHeight(gx, gz, seed), b = getTerrainHeight(gx + CELL_SIZE, gz, seed), c = getTerrainHeight(gx, gz + CELL_SIZE, seed), d = getTerrainHeight(gx + CELL_SIZE, gz + CELL_SIZE, seed);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
