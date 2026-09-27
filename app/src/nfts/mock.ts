import type { Address } from 'viem';
import { MockInventoryProvider, type Data } from '../items/mockInventory.ts';
import { itemDefinition } from '../items/definitions.ts';
import { validateTransform, type LocalTransform } from '../items/model.ts';
import { assetKey, parseAssetKey, validateLocation, evaluateAccess, type NFTAsset, type AttachedLocation, type NFTStateProvider, type WorldContainer, type WorldDoor, type NFTSnapshot, type AccessRequirement } from './model.ts';
export const MOCK_NFT_COLLECTION = '0x3333333333333333333333333333333333333333' as Address;
export const MOCK_ITEMS = '0x4444444444444444444444444444444444444444' as Address;
export const MOCK_NFT_ESCROW = '0x5555555555555555555555555555555555555555' as Address;
interface Entry {
    owner: Address;
    depositor?: Address;
    location?: AttachedLocation;
}
export interface NFTData {
    schema: 1;
    assets: Record<string, Entry>;
    containers: WorldContainer[];
    doors: Omit<WorldDoor, 'requirement'>[];
    requirements: Record<number, {
        kind: 'erc1155' | 'erc721';
        contractAddress: Address;
        tokenId: string;
        minimum?: string;
    }>;
    items: Record<number, Record<number, string>>;
    nextContainer: number;
    nextDoor: number;
}
export class MockNFTProvider implements NFTStateProvider {
    readonly enabled = true;
    private ledger: MockInventoryProvider;
    private chain: number;
    private initial: Address;
    private owns: (id: number) => boolean;
    constructor(ledger: MockInventoryProvider, chain: number, initial: Address, owns: (id: number) => boolean) { this.ledger = ledger; this.chain = chain; this.initial = initial; this.owns = owns; }
    knownAssets() { return [1n, 2n, 77n, 12n].map(tokenId => ({ chainId: this.chain, contractAddress: MOCK_NFT_COLLECTION, tokenId })); }
    private data(data: Data): NFTData { return data.nftState ??= { schema: 1, assets: Object.fromEntries(this.knownAssets().map(a => [assetKey(a), { owner: this.initial }])), containers: [], doors: [], requirements: {}, items: {}, nextContainer: 0, nextDoor: 0 }; }
    private check(id: number) { if (!this.owns(id))
        throw new Error('Only the current parcel owner may modify attachments'); }
    private entry(data: NFTData, asset: NFTAsset) { if (asset.chainId !== this.chain)
        throw new Error('Wrong chain'); const entry = data.assets[assetKey(asset)]; if (!entry)
        throw new Error('Unknown mock NFT; choose a development fixture'); return entry; }
    private container(data: NFTData, id: number) { const c = data.containers.find(c => c.id === id); if (!c)
        throw new Error('Container not found'); return c; }
    private reserve(data: NFTData, location: AttachedLocation, delta: number) { if (location.kind === 'container') {
        const c = this.container(data, location.containerId);
        if (c.parcelId !== location.parcelId)
            throw new Error('Container belongs to another parcel');
        if (c.occupied + delta > c.capacity)
            throw new Error('Container capacity reached');
        c.occupied += delta;
    } }
    async ownerOf(asset: NFTAsset) { return this.entry(this.data(this.ledger.read()), asset).owner; }
    async tokenURI(asset: NFTAsset) { this.entry(this.data(this.ledger.read()), asset); const names: Record<string, string> = { '1': 'Atlas Character', '2': 'Atlas Pet', '77': 'External Art', '12': 'Atlas Vehicle' }; return `data:application/json;utf8,${encodeURIComponent(JSON.stringify({ name: `${names[String(asset.tokenId)]} #${asset.tokenId}`, description: 'Local development fixture', attributes: [{ trait_type: 'Origin', value: 'Atlas development' }] }))}`; }
    async snapshot(parcelId: number): Promise<NFTSnapshot> { const d = this.data(this.ledger.read()); return { attachments: Object.entries(d.assets).filter(([, e]) => e.location?.parcelId === parcelId).map(([key, e]) => ({ asset: parseAssetKey(key), location: e.location!, depositor: e.depositor! })), containers: d.containers.filter(c => c.parcelId === parcelId), doors: d.doors.filter(c => c.parcelId === parcelId).map(c => { const r = d.requirements[c.id]; return { ...c, requirement: r.kind === 'erc1155' ? { ...r, kind: 'erc1155', tokenId: BigInt(r.tokenId), minimum: BigInt(r.minimum!), mode: 'CHECK_ONLY' } : { ...r, kind: 'erc721', tokenId: BigInt(r.tokenId), mode: 'CHECK_ONLY' } }; }) }; }
    async approve(asset: NFTAsset) { this.entry(this.data(this.ledger.read()), asset); }
    async attach(asset: NFTAsset, location: AttachedLocation) { validateLocation(location); await this.ledger.mutate((raw, owner) => { const d = this.data(raw), e = this.entry(d, asset); this.check(location.parcelId); if (e.location || e.owner.toLowerCase() !== owner.toLowerCase())
        throw new Error('NFT is not in your wallet'); if (Object.values(d.assets).filter(e => e.location?.parcelId === location.parcelId).length >= 64)
        throw new Error('Parcel capacity reached'); this.reserve(d, location, 1); e.owner = MOCK_NFT_ESCROW; e.depositor = owner; e.location = location; }); }
    async move(asset: NFTAsset, location: AttachedLocation) { validateLocation(location); await this.ledger.mutate(raw => { const d = this.data(raw), e = this.entry(d, asset); if (!e.location)
        throw new Error('NFT is not attached'); this.check(e.location.parcelId); this.check(location.parcelId); this.reserve(d, e.location, -1); this.reserve(d, location, 1); e.location = location; }); }
    async detach(asset: NFTAsset) { await this.ledger.mutate((raw, owner) => { const d = this.data(raw), e = this.entry(d, asset); if (!e.location)
        throw new Error('NFT is not attached'); this.check(e.location.parcelId); this.reserve(d, e.location, -1); delete e.location; e.owner = owner; }); }
    async createContainer(parcelId: number, t: LocalTransform, capacity: number) { validateLocation({ kind: 'parcel', parcelId, ...t }); if (!Number.isInteger(capacity) || capacity < 1 || capacity > 32)
        throw new Error('Capacity must be 1–32'); await this.ledger.mutate(raw => { this.check(parcelId); const d = this.data(raw); if (d.containers.filter(c => c.parcelId === parcelId).length >= 32)
        throw new Error('Container limit'); d.containers.push({ ...t, id: ++d.nextContainer, parcelId, capacity, occupied: 0 }); }); }
    async removeContainer(id: number) { await this.ledger.mutate(raw => { const d = this.data(raw), c = this.container(d, id); this.check(c.parcelId); if (c.occupied)
        throw new Error(`Cannot remove container: contains ${c.occupied} assets`); d.containers = d.containers.filter(c => c.id !== id); delete d.items[id]; }); }
    async containerBalance(id: number) { const d = this.data(this.ledger.read()); this.container(d, id); return [1, 2, 3, 4, 5, 6].map(i => BigInt(d.items[id]?.[i] ?? 0)); }
    async approveItems() { }
    private async changeItem(id: number, item: number, amount: bigint, store: boolean) { if (amount <= 0n)
        throw new Error('Positive quantity required'); await this.ledger.mutate((raw, owner) => { const d = this.data(raw), c = this.container(d, id); this.check(c.parcelId); const values = d.items[id] ??= {}, before = BigInt(values[item] ?? 0), after = before + (store ? amount : -amount); if (after < 0n || after > itemDefinition(item).maxStack)
        throw new Error('Invalid quantity'); if (before === 0n && after > 0n) {
        if (c.occupied >= c.capacity)
            throw new Error('Container capacity reached');
        c.occupied++;
    } if (before > 0n && after === 0n)
        c.occupied--; this.ledger.credit(raw, owner, item, store ? -amount : amount); values[item] = String(after); }); }
    async storeItem(id: number, item: number, amount: bigint) { await this.changeItem(id, item, amount, true); }
    async retrieveItem(id: number, item: number, amount: bigint) { await this.changeItem(id, item, amount, false); }
    async createDoor(parcelId: number, t: LocalTransform, requirement: AccessRequirement) { validateTransform(t, 150); assetKey({ chainId: this.chain, contractAddress: requirement.contractAddress, tokenId: requirement.tokenId }); if (requirement.kind === 'erc1155' && requirement.minimum <= 0n)
        throw new Error('Positive key quantity required'); await this.ledger.mutate(raw => { this.check(parcelId); const d = this.data(raw); if (d.doors.filter(c => c.parcelId === parcelId).length >= 32)
        throw new Error('Door limit'); const id = ++d.nextDoor; d.doors.push({ ...t, id, parcelId }); d.requirements[id] = { kind: requirement.kind, contractAddress: requirement.contractAddress, tokenId: String(requirement.tokenId), ...(requirement.kind === 'erc1155' ? { minimum: String(requirement.minimum) } : {}) }; }); }
    async removeDoor(parcelId: number, id: number) { await this.ledger.mutate(raw => { this.check(parcelId); const d = this.data(raw); if (!d.doors.some(door => door.id === id && door.parcelId === parcelId))
        throw new Error('Door not found'); d.doors = d.doors.filter(door => door.id !== id); delete d.requirements[id]; }); }
    async canOpen(door: WorldDoor, account: Address) { return evaluateAccess(door.requirement, account, { balance: async (contract, owner, id) => contract.toLowerCase() === MOCK_ITEMS.toLowerCase() ? this.ledger.getBalance(owner, id) : 0n, owner: (contractAddress, tokenId) => this.ownerOf({ chainId: this.chain, contractAddress, tokenId }) }); }
}
