import { PARCEL_SIZE } from '../world/constants.ts';
import { parcelToWorld, tokenIdToCoordinate } from '../world/coordinates.ts';

export const COORDINATE_SCALE = 100;
export const MAX_OBJECTS = 128;
export const STATE_SCHEMA = 1;
export const OBJECT_TYPES = {
  1: { name: 'Cube', radius: 142 },
  2: { name: 'Platform', radius: 361 },
  3: { name: 'Pillar', radius: 80 },
  4: { name: 'Tree', radius: 200 },
  5: { name: 'Rock', radius: 120 },
} as const;
export type WorldObjectType = keyof typeof OBJECT_TYPES;
export interface ObjectPlacement { objectType: WorldObjectType; x: number; z: number; rotation: number }
export interface PersistentWorldObject extends ObjectPlacement { id: number }

export function validatePlacement(object: ObjectPlacement): void {
  if (!Number.isInteger(object.objectType) || !Object.hasOwn(OBJECT_TYPES, object.objectType)) throw new Error('Unknown object type');
  const definition = OBJECT_TYPES[object.objectType];
  if (!definition) throw new Error('Unknown object type');
  const limit = PARCEL_SIZE * COORDINATE_SCALE, radius = definition.radius;
  if (![object.x, object.z, object.rotation].every(Number.isInteger) || object.x < radius || object.z < radius || object.x > limit - radius || object.z > limit - radius || object.rotation < 0 || object.rotation >= 36000) {
    throw new Error('Object footprint must fit inside the parcel; rotation must be 0–359.99°.');
  }
}
export function worldToObjectPosition(tokenId: number, x: number, z: number) {
  const origin = parcelToWorld(tokenIdToCoordinate(tokenId));
  return { x: Math.round((x - origin.x) * COORDINATE_SCALE), z: Math.round((z - origin.z) * COORDINATE_SCALE) };
}
export function objectToWorldPosition(tokenId: number, object: Pick<ObjectPlacement, 'x' | 'z'>) {
  return parcelToWorld(tokenIdToCoordinate(tokenId), object.x / COORDINATE_SCALE, object.z / COORDINATE_SCALE);
}
