import type { Address } from 'viem';
import type { WalletItem, ItemPlacement, LocalTransform, Portal, AttachedWorldItem } from './model.ts';
export interface InventoryProvider { getBalance(address: Address, itemId: bigint): Promise<bigint>; getInventory(address: Address): Promise<WalletItem[]> }
export interface InventoryWriter { transferItem(to: Address, itemId: number, quantity: bigint): Promise<void> }
export interface WorldItemProvider { getItems(tokenId: number): Promise<AttachedWorldItem[]> }
export interface WorldItemWriter { placeItem(tokenId: number, item: ItemPlacement): Promise<void>; pickupItem(tokenId: number, instanceId: number): Promise<void>; evictItem(tokenId: number, instanceId: number): Promise<void> }
export interface PortalProvider { getPortals(tokenId: number): Promise<Portal[]> }
export interface PortalWriter { placePortal(tokenId: number, portal: LocalTransform & { destinationTokenId: number }): Promise<void>; removePortal(tokenId: number, portalId: number): Promise<void> }
export interface ExperienceStore extends InventoryProvider, InventoryWriter, WorldItemProvider, WorldItemWriter, PortalProvider, PortalWriter {
  readonly enabled: boolean;
  approveEscrow(): Promise<void>;
  isEscrowApproved(): Promise<boolean>;
  grantDevItem?(itemId: number, quantity: bigint): Promise<void>;
  subscribe?(listener: () => void): () => void;
}
