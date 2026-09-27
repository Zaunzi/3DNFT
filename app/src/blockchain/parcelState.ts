import type { ObjectPlacement, PersistentWorldObject } from '../objects/model.ts';

export interface ParcelStateProvider {
  getObjects(tokenId: bigint): Promise<PersistentWorldObject[]>;
  // Events are invalidation hints; reload canonical snapshots instead of treating logs as the database.
  subscribe?(onChange: (tokenId: bigint) => void, onError?: (error: unknown) => void): () => void;
}
export interface ParcelStateWriter {
  addObject(tokenId: bigint, placement: ObjectPlacement): Promise<void>;
  removeObject(tokenId: bigint, objectId: number): Promise<void>;
}
export type ParcelStateStore = ParcelStateProvider & ParcelStateWriter;
