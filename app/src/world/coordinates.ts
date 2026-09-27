import { MAX_SUPPLY, PARCEL_SIZE, WORLD_DEPTH, WORLD_WIDTH } from './constants.ts';
export interface ParcelCoordinate { x: number; z: number }
export function tokenIdToCoordinate(tokenId: number): ParcelCoordinate {
  if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId >= MAX_SUPPLY) throw new RangeError('Token must be an integer from 0 to 4999');
  return { x: tokenId % WORLD_WIDTH, z: Math.floor(tokenId / WORLD_WIDTH) };
}
export function coordinateToTokenId(x: number, z: number): number | null {
  return Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < WORLD_WIDTH && z < WORLD_DEPTH ? z * WORLD_WIDTH + x : null;
}
export function worldToParcel(x: number, z: number): ParcelCoordinate { return { x: Math.floor(x / PARCEL_SIZE), z: Math.floor(z / PARCEL_SIZE) }; }
export function parcelToWorld(c: ParcelCoordinate, localX = 0, localZ = 0) { return { x: c.x * PARCEL_SIZE + localX, z: c.z * PARCEL_SIZE + localZ }; }
export function getNeighbors(c: ParcelCoordinate) { return { north: coordinateToTokenId(c.x, c.z - 1), south: coordinateToTokenId(c.x, c.z + 1), east: coordinateToTokenId(c.x + 1, c.z), west: coordinateToTokenId(c.x - 1, c.z) }; }
export function nearbyTokenIds(c: ParcelCoordinate, radius: number): number[] {
  const ids: number[] = [];
  for (let z = c.z - radius; z <= c.z + radius; z++) for (let x = c.x - radius; x <= c.x + radius; x++) { const id = coordinateToTokenId(x, z); if (id !== null) ids.push(id); }
  return ids;
}
export function parseTokenId(value: string | null): number {
  if (value === null) return 742;
  if (!/^\d+$/.test(value)) throw new RangeError('Invalid tokenId; use an integer from 0 to 4999.');
  const id = Number(value); tokenIdToCoordinate(id); return id;
}
