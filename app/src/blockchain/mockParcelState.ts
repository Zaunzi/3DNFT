import { MAX_OBJECTS, STATE_SCHEMA, validatePlacement, type ObjectPlacement, type PersistentWorldObject } from '../objects/model.ts';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
import type { ParcelStateStore } from './parcelState.ts';

export interface LocalStorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface StoredParcel { schema: number; nextId: number; objects: PersistentWorldObject[] }
export const MOCK_STORAGE_PREFIX = 'atlas:7422026:generator1:objects:v1:';

export function decodeMockParcel(raw: string | null): StoredParcel {
  if (raw === null) return { schema: STATE_SCHEMA, nextId: 0, objects: [] };
  const data = JSON.parse(raw) as StoredParcel;
  if (data.schema !== STATE_SCHEMA || !Number.isInteger(data.nextId) || data.nextId < 0 || data.nextId > 0xffffffff || !Array.isArray(data.objects) || data.objects.length > MAX_OBJECTS) throw new Error('Invalid local parcel data');
  const ids = new Set<number>();
  for (const object of data.objects) {
    validatePlacement(object);
    if (!Number.isInteger(object.id) || object.id <= 0 || object.id > data.nextId || ids.has(object.id)) throw new Error('Invalid local object ID');
    ids.add(object.id);
  }
  return data;
}

/** Browser-local prototype only: editable storage and simulated identities are not security. */
export class MockParcelStateProvider implements ParcelStateStore {
  private storage: LocalStorageLike;
  private authorize: (tokenId: number) => boolean;
  private listeners = new Set<(tokenId: bigint) => void>();
  constructor(storage: LocalStorageLike, authorize: (tokenId: number) => boolean) { this.storage = storage; this.authorize = authorize; }
  private key(tokenId: bigint) { tokenIdToCoordinate(Number(tokenId)); return `${MOCK_STORAGE_PREFIX}${tokenId}`; }
  async getObjects(tokenId: bigint) { return decodeMockParcel(this.storage.getItem(this.key(tokenId))).objects; }
  private write(tokenId: bigint, update: (data: StoredParcel) => void) {
    const key = this.key(tokenId);
    if (!this.authorize(Number(tokenId))) throw new Error('Only the parcel owner may build here.');
    const data = decodeMockParcel(this.storage.getItem(key));
    update(data);
    // A failed/quota-denied write throws; never claim success without persistence.
    this.storage.setItem(key, JSON.stringify(data));
    for (const listener of this.listeners) listener(tokenId);
  }
  async addObject(tokenId: bigint, placement: ObjectPlacement) {
    validatePlacement(placement);
    this.write(tokenId, data => {
      if (data.objects.length >= MAX_OBJECTS) throw new Error('Parcel has reached its 128-object limit.');
      if (data.nextId === 0xffffffff) throw new Error('Object ID space exhausted');
      data.objects.push({ ...placement, id: ++data.nextId });
    });
  }
  async removeObject(tokenId: bigint, objectId: number) {
    this.write(tokenId, data => {
      const index = data.objects.findIndex(object => object.id === objectId);
      if (index === -1) throw new Error('Object no longer exists.');
      data.objects[index] = data.objects[data.objects.length - 1]; data.objects.pop();
    });
  }
  subscribe(onChange: (tokenId: bigint) => void) {
    this.listeners.add(onChange);
    const handler = (event: StorageEvent) => {
      if (event.key === null) return; // Clearing all local data is handled by normal refresh/focus reconciliation.
      if (event.key.startsWith(MOCK_STORAGE_PREFIX)) { const id = event.key.slice(MOCK_STORAGE_PREFIX.length); if (/^\d+$/.test(id)) onChange(BigInt(id)); }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handler);
    return () => { this.listeners.delete(onChange); if (typeof window !== 'undefined') window.removeEventListener('storage', handler); };
  }
}
