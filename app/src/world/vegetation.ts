import { PARCEL_SIZE } from './constants.ts';
import { parcelToWorld, type ParcelCoordinate } from './coordinates.ts';
import { hash, seed32 } from './noise.ts';
export interface Decoration { x: number; z: number; scale: number; rotation: number; kind: 'tree' | 'rock' }
export function getVegetation(c: ParcelCoordinate, seed: bigint): Decoration[] {
  const s = seed32(seed), result: Decoration[] = [];
  // One jittered candidate per global 8-unit cell; half-open ownership prevents duplicates.
  for (let z = 0; z < PARCEL_SIZE / 8; z++) for (let x = 0; x < PARCEL_SIZE / 8; x++) {
    const gx = c.x * 8 + x, gz = c.z * 8 + z, h = hash(gx, gz, s ^ 421);
    if (h % 5 > 1) continue;
    const p = parcelToWorld(c, x * 8 + 1 + ((h >>> 8) % 600) / 100, z * 8 + 1 + ((h >>> 18) % 600) / 100);
    result.push({ ...p, scale: 0.7 + (h % 100) / 100, rotation: (h % 628) / 100, kind: h % 5 === 0 ? 'tree' : 'rock' });
  }
  return result;
}
