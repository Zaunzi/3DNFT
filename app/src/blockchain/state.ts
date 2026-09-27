import { DEFAULT_SEED, GENERATOR_VERSION } from '../world/constants.ts';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
export interface WorldIdentity { seed: bigint; generatorVersion: number }
export interface ParcelState { version: number; owner: string | null }
// Future adapters can resolve buildings/messages from a content hash, and portals
// from a chainId + contractAddress + tokenId reference. No rendering types belong here.
export interface WorldStateProvider { readonly mode: string; getWorld(): Promise<WorldIdentity>; getParcel(tokenId: number): Promise<ParcelState> }
export class MockWorldState implements WorldStateProvider {
  readonly mode = 'MOCK STATE';
  private ownerFor?: (id: number) => string;
  constructor(ownerFor?: (id: number) => string) { this.ownerFor = ownerFor; }
  async getWorld() { return { seed: DEFAULT_SEED, generatorVersion: GENERATOR_VERSION }; }
  async getParcel(tokenId: number) { tokenIdToCoordinate(tokenId); return { version: 0, owner: this.ownerFor?.(tokenId) ?? `0x${BigInt(tokenId + 1).toString(16).padStart(40, '0')}` }; }
}
