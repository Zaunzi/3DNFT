import { CRYPTODOODZ_FIXTURES } from './cryptodoodzFixtures.ts';
import type { Address } from 'viem';
import { MockInventoryProvider, type Data } from '../items/mockInventory.ts';
import { itemDefinition } from '../items/definitions.ts';
import { validateTransform, type LocalTransform } from '../items/model.ts';
import { assetKey, parseAssetKey, validateLocation, evaluateAccess, type NFTAsset, type AttachedLocation, type NFTStateProvider, type WorldContainer, type WorldDoor, type NFTSnapshot, type AccessRequirement } from './model.ts';
export const MOCK_NFT_COLLECTION = '0x3333333333333333333333333333333333333333' as Address;
export const MOCK_ITEMS = '0x4444444444444444444444444444444444444444' as Address;
export const MOCK_KEYS = '0x6666666666666666666666666666666666666666' as Address;
export const MOCK_NFT_ESCROW = '0x5555555555555555555555555555555555555555' as Address;
interface Entry {
    owner: Address;
    depositor?: Address;
    location?: AttachedLocation;
}
export interface NFTData {
    schema: 1;
    nextKey?:number;
    keys?:Record<string,{parcel:number;epoch:number;revoked:boolean;balances:Record<string,string>}>;
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
    readonly lockKeys = MOCK_KEYS;
    private ledger: MockInventoryProvider;
    private chain: number;
    private initial: Address;
    private ownerFor?: (id:number)=>Address;
    private epochFor: (id:number)=>number;
    private owns: (id: number) => boolean;
    constructor(ledger: MockInventoryProvider, chain: number, initial: Address, owns: (id: number) => boolean, ownerFor?: (id:number)=>Address, epochFor:(id:number)=>number=()=>0) { this.ledger = ledger; this.chain = chain; this.initial = initial; this.owns = owns; this.ownerFor=ownerFor;this.epochFor=epochFor; }
    async ownedCharacters(owner:Address) { const rows=await Promise.all(this.knownAssets().map(async asset=>({asset,owner:await this.ownerOf(asset)})));return rows.filter(row=>row.owner.toLowerCase()===owner.toLowerCase()).map(row=>row.asset); }
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
    async tokenURI(asset: NFTAsset) { this.entry(this.data(this.ledger.read()), asset); return `data:application/json;utf8,${encodeURIComponent(JSON.stringify(CRYPTODOODZ_FIXTURES[String(asset.tokenId)]))}`; }
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
    private newKey(d:NFTData,parcel:number,owner:Address) {const id=d.nextKey=(d.nextKey??0)+1;(d.keys??={})[id]={parcel,epoch:this.epochFor(parcel),revoked:false,balances:{[owner.toLowerCase()]:'1'}};return id;}
    async createKeyedDoor(parcel:number,t:LocalTransform & {y?:number}) {
        validateTransform(t,150);if(t.y!==undefined&&(!Number.isInteger(t.y)||Math.abs(t.y)>32000))throw new Error('Invalid door height');
        await this.ledger.mutate((raw,owner)=>{this.check(parcel);const d=this.data(raw);if(d.doors.filter(v=>v.parcelId===parcel).length>=32)throw new Error('Door limit');const id=++d.nextDoor,key=this.newKey(d,parcel,owner);d.doors.push({...t,id,parcelId:parcel});d.requirements[id]={kind:'erc1155',contractAddress:MOCK_KEYS,tokenId:String(key),minimum:'1'};});
    }
    async rekeyDoor(parcel:number,id:number){await this.ledger.mutate((raw,owner)=>{this.check(parcel);const d=this.data(raw),door=d.doors.find(v=>v.id===id&&v.parcelId===parcel),r=d.requirements[id];if(!door||r.contractAddress!==MOCK_KEYS)throw new Error('Unknown keyed door');d.keys![r.tokenId].revoked=true;r.tokenId=String(this.newKey(d,parcel,owner));});}
    async issueKeyCopies(id:bigint,to:Address,quantity:bigint){await this.ledger.mutate(raw=>{const d=this.data(raw),k=d.keys?.[String(id)];if(!k||k.revoked||k.epoch!==this.epochFor(k.parcel))throw new Error('Key expired');this.check(k.parcel);if(quantity<1n||quantity>100n)throw new Error('Choose 1–100 copies');k.balances[to.toLowerCase()]=String(BigInt(k.balances[to.toLowerCase()]??0)+quantity);});}
    async createDoor(parcelId: number, t: LocalTransform & {y?:number}, requirement: AccessRequirement) { validateTransform(t, 150); if(t.y!==undefined && (!Number.isInteger(t.y)||t.y < -32000||t.y>32000))throw new Error('Invalid door height'); assetKey({ chainId: this.chain, contractAddress: requirement.contractAddress, tokenId: requirement.tokenId }); if (requirement.kind === 'erc1155' && requirement.minimum <= 0n)
        throw new Error('Positive key quantity required'); await this.ledger.mutate(raw => { this.check(parcelId); const d = this.data(raw); if (d.doors.filter(c => c.parcelId === parcelId).length >= 32)
        throw new Error('Door limit'); const id = ++d.nextDoor; d.doors.push({ ...t, id, parcelId }); d.requirements[id] = { kind: requirement.kind, contractAddress: requirement.contractAddress, tokenId: String(requirement.tokenId), ...(requirement.kind === 'erc1155' ? { minimum: String(requirement.minimum) } : {}) }; }); }
    async removeDoor(parcelId: number, id: number) { await this.ledger.mutate(raw => { this.check(parcelId); const d = this.data(raw); if (!d.doors.some(door => door.id === id && door.parcelId === parcelId))
        throw new Error('Door not found'); if(d.requirements[id]?.contractAddress===MOCK_KEYS)d.keys![d.requirements[id].tokenId].revoked=true;d.doors = d.doors.filter(door => door.id !== id); delete d.requirements[id]; }); }
    async canOpen(door: WorldDoor, account: Address) {
      if(door.requirement.contractAddress===MOCK_KEYS){const d=this.data(this.ledger.read()),current=d.doors.find(v=>v.id===door.id&&v.parcelId===door.parcelId);if(!current)return false;const key=d.keys?.[d.requirements[door.id].tokenId];if(this.ownerFor?.(door.parcelId).toLowerCase()===account.toLowerCase())return true;return !!key&&!key.revoked&&key.epoch===this.epochFor(key.parcel)&&BigInt(key.balances[account.toLowerCase()]??0)>0n;}
      return evaluateAccess(door.requirement, account, { balance: async (contract, owner, id) => contract.toLowerCase() === MOCK_ITEMS.toLowerCase() ? this.ledger.getBalance(owner, id) : 0n, owner: (contractAddress, tokenId) => this.ownerOf({ chainId: this.chain, contractAddress, tokenId }) }); }
}
