import { getAddress, type Address } from 'viem';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
import { validateTransform, type LocalTransform } from '../items/model.ts';
export interface NFTAsset {
    chainId: number;
    contractAddress: Address;
    tokenId: bigint;
}
export type AssetLocation = {
    kind: 'wallet';
    owner: Address;
} | ({
    kind: 'parcel';
    parcelId: number;
} & LocalTransform) | {
    kind: 'container';
    parcelId: number;
    containerId: number;
};
export type AttachedLocation = Exclude<AssetLocation, {
    kind: 'wallet';
}>;
export interface NFTAttachment {
    asset: NFTAsset;
    location: AttachedLocation;
    depositor: Address;
}
export interface WorldContainer extends LocalTransform {
    id: number;
    parcelId: number;
    capacity: number;
    occupied: number;
}
export type AccessRequirement = {
    kind: 'erc1155';
    contractAddress: Address;
    tokenId: bigint;
    minimum: bigint;
    mode: 'CHECK_ONLY';
} | {
    kind: 'erc721';
    contractAddress: Address;
    tokenId: bigint;
    mode: 'CHECK_ONLY';
};
export interface WorldDoor extends LocalTransform {
    /** Mock building elevation only; the deployed door contract remains terrain anchored. */
    y?: number;
    id: number;
    parcelId: number;
    requirement: AccessRequirement;
}
export interface NFTSnapshot {
    attachments: NFTAttachment[];
    containers: WorldContainer[];
    doors: WorldDoor[];
}
export function assetKey(asset: NFTAsset): string {
    if (!Number.isSafeInteger(asset.chainId) || asset.chainId <= 0 || typeof asset.tokenId !== 'bigint' || asset.tokenId < 0n || asset.tokenId >= 1n << 256n)
        throw new Error('Invalid NFT identity');
    return `${asset.chainId}:${getAddress(asset.contractAddress).toLowerCase()}:${asset.tokenId}`;
}
export function parseAssetKey(key: string): NFTAsset { const [chain, contract, id, ...extra] = key.split(':'); if (extra.length || !/^\d+$/.test(id ?? '') || !/^\d+$/.test(chain ?? ''))
    throw new Error('Invalid NFT identity'); const asset = { chainId: Number(chain), contractAddress: getAddress(contract), tokenId: BigInt(id) }; assetKey(asset); return asset; }
export function validateLocation(location: AttachedLocation) { tokenIdToCoordinate(location.parcelId); if (location.kind === 'parcel')
    validateTransform(location, 150);
else if (location.kind !== 'container' || !Number.isInteger(location.containerId) || location.containerId < 1 || location.containerId > 0xffffffff)
    throw new Error('Invalid container location'); }
export interface NFTStateProvider {
    readonly enabled: boolean;
    snapshot(parcelId: number): Promise<NFTSnapshot>;
    ownerOf(asset: NFTAsset): Promise<Address>;
    tokenURI(asset: NFTAsset): Promise<string>;
    knownAssets(): NFTAsset[];
    approve(asset: NFTAsset): Promise<void>;
    attach(asset: NFTAsset, location: AttachedLocation): Promise<void>;
    move(asset: NFTAsset, location: AttachedLocation): Promise<void>;
    detach(asset: NFTAsset): Promise<void>;
    createContainer(parcelId: number, transform: LocalTransform, capacity: number): Promise<void>;
    removeContainer(id: number): Promise<void>;
    containerBalance(id: number): Promise<bigint[]>;
    approveItems(): Promise<void>;
    storeItem(id: number, item: number, amount: bigint): Promise<void>;
    retrieveItem(id: number, item: number, amount: bigint): Promise<void>;
    createDoor(parcelId: number, transform: LocalTransform, requirement: AccessRequirement): Promise<void>;
    removeDoor(parcelId: number, id: number): Promise<void>;
    canOpen(door: WorldDoor, account: Address): Promise<boolean>;
}
export async function evaluateAccess(requirement: AccessRequirement, account: Address, read: {
    balance: (contract: Address, account: Address, id: bigint) => Promise<bigint>;
    owner: (contract: Address, id: bigint) => Promise<Address>;
}) {
    try {
        return requirement.kind === 'erc1155' ? await read.balance(requirement.contractAddress, account, requirement.tokenId) >= requirement.minimum : (await read.owner(requirement.contractAddress, requirement.tokenId)).toLowerCase() === account.toLowerCase();
    }
    catch {
        return false;
    }
}
