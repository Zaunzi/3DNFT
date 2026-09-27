import type { Address } from 'viem';
import { itemDefinition } from './definitions.ts';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
export const INTERACTION_DISTANCE = 5;
export const MAX_WORLD_ITEMS = 64;
export const MAX_PORTALS = 16;
export interface LocalTransform { x: number; z: number; rotation: number }
export interface ItemPlacement extends LocalTransform { itemType: number; quantity: bigint }
/** Escrow-backed parcel property. Depositor is provenance, never withdrawal authority. */
export interface AttachedWorldItem extends ItemPlacement { id: number; parcelTokenId: number; depositor: Address }
export interface Portal extends LocalTransform { id: number; parcelTokenId: number; destinationTokenId: number }
/** Liquid ERC-1155 balance for the wallet queried by InventoryProvider; excludes attachments. */
export interface WalletItem { itemId: number; balance: bigint }
export function validateTransform(transform: LocalTransform, radius: number) {
  if (![transform.x, transform.z, transform.rotation].every(Number.isInteger) || transform.x < radius || transform.z < radius || transform.x > 6400-radius || transform.z > 6400-radius || transform.rotation < 0 || transform.rotation >= 36000) throw new Error('Invalid placement: keep the full footprint inside the parcel.');
}
export function validateItemPlacement(item: ItemPlacement) {
  const definition = itemDefinition(item.itemType); validateTransform(item, 100);
  if (typeof item.quantity !== 'bigint' || item.quantity <= 0n || item.quantity > definition.maxStack) throw new Error(`Quantity must be 1–${definition.maxStack}.`);
}
export function validatePortal(portal: LocalTransform & { destinationTokenId: number }) { validateTransform(portal, 200); tokenIdToCoordinate(portal.destinationTokenId); }
