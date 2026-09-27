import { parseAbi, type Address, type Abi } from 'viem';
import type { OnchainParcelStateProvider } from '../blockchain/client.ts';
import type { InjectedWallet } from '../blockchain/wallet.ts';
import { assetKey, validateLocation, type NFTAsset, type NFTStateProvider, type AttachedLocation, type NFTSnapshot, type WorldDoor, type AccessRequirement } from './model.ts';
import type { LocalTransform } from '../items/model.ts';
export const nftAbi = parseAbi(['function ownerOf(uint256) view returns(address)', 'function tokenURI(uint256) view returns(string)', 'function approve(address,uint256)']);
export const nftStateAbi = parseAbi([
    'function land() view returns(address)', 'function SCHEMA_VERSION() view returns(uint8)', 'function containerItems() view returns(address)',
    'function getAttachments(uint256) view returns((address collection,uint256 tokenId,address depositor,(uint16 parcelId,uint32 containerId,uint16 x,uint16 z,uint16 rotation) location)[])',
    'function getContainers(uint256) view returns((uint32 id,uint16 parcelId,uint16 x,uint16 z,uint16 rotation,uint8 capacity,uint8 occupied)[])',
    'function getDoors(uint256) view returns((uint32 id,uint16 parcelId,uint16 x,uint16 z,uint16 rotation,uint8 kind,address collection,uint256 tokenId,uint256 minimum)[])',
    'function attach(address,uint256,(uint16 parcelId,uint32 containerId,uint16 x,uint16 z,uint16 rotation))',
    'function move(address,uint256,(uint16 parcelId,uint32 containerId,uint16 x,uint16 z,uint16 rotation))', 'function detach(address,uint256)',
    'function createContainer(uint16,uint16,uint16,uint16,uint8)', 'function removeContainer(uint32)',
    'function createDoor(uint16,uint16,uint16,uint16,uint8,address,uint256,uint256)', 'function removeDoor(uint16,uint32)',
    'function canOpen(uint16,uint32,address) view returns(bool)',
]);
export const containerItemAbi = parseAbi(['function world() view returns(address)', 'function items() view returns(address)', 'function getBalances(uint32) view returns(uint256[6])', 'function store(uint32,uint16,uint256)', 'function retrieve(uint32,uint16,uint256)']);
export class OnchainNFTProvider implements NFTStateProvider {
    readonly enabled: boolean;
    private client: OnchainParcelStateProvider['client'];
    private wallet: InjectedWallet;
    private addresses: {
        land: Address;
        world?: Address;
        containers?: Address;
        items?: Address;
        characters?: Address;
    };
    constructor(client: OnchainParcelStateProvider['client'], wallet: InjectedWallet, addresses: OnchainNFTProvider['addresses']) { this.client = client; this.wallet = wallet; this.addresses = addresses; this.enabled = !!(addresses.world && addresses.containers && addresses.items); }
    async validateDeployment() { const a = this.addresses; if (!a.world && !a.containers)
        return; if (!this.enabled)
        throw new Error('Configure WorldNFTState, ContainerItemState and AtlasItems'); const values = await Promise.all([this.client.readContract({ address: a.world!, abi: nftStateAbi, functionName: 'land' }), this.client.readContract({ address: a.world!, abi: nftStateAbi, functionName: 'SCHEMA_VERSION' }), this.client.readContract({ address: a.world!, abi: nftStateAbi, functionName: 'containerItems' }), this.client.readContract({ address: a.containers!, abi: containerItemAbi, functionName: 'world' }), this.client.readContract({ address: a.containers!, abi: containerItemAbi, functionName: 'items' })]); if (values[0].toLowerCase() !== a.land.toLowerCase() || values[1] !== 1 || values[2].toLowerCase() !== a.containers!.toLowerCase() || values[3].toLowerCase() !== a.world!.toLowerCase() || values[4].toLowerCase() !== a.items!.toLowerCase())
        throw new Error('NFT deployment binding mismatch'); }
    knownAssets() { return this.addresses.characters ? [{ chainId: this.client.chain.id, contractAddress: this.addresses.characters, tokenId: 1n }] : []; }
    private asset(asset: NFTAsset) { assetKey(asset); if (asset.chainId !== this.client.chain.id)
        throw new Error('Cross-chain attachment unsupported'); }
    private async write(address: Address | undefined, abi: Abi, functionName: string, args: readonly unknown[]) { if (!this.enabled || !address)
        throw new Error('NFT custody is not configured'); const wallet = await this.wallet.forChain(this.client.chain.id); const { request } = await this.client.simulateContract({ address, abi, functionName, args, account: wallet.account }); const fresh = await this.wallet.forChain(this.client.chain.id); if (fresh.account.address !== wallet.account.address)
        throw new Error('Wallet changed'); const hash = await fresh.writeContract({ ...request, chain: this.client.chain }); if ((await this.client.waitForTransactionReceipt({ hash })).status !== 'success')
        throw new Error('Transaction reverted'); }
    async ownerOf(asset: NFTAsset) { this.asset(asset); return this.client.readContract({ address: asset.contractAddress, abi: nftAbi, functionName: 'ownerOf', args: [asset.tokenId] }); }
    async tokenURI(asset: NFTAsset) { this.asset(asset); return this.client.readContract({ address: asset.contractAddress, abi: nftAbi, functionName: 'tokenURI', args: [asset.tokenId] }); }
    async snapshot(parcelId: number): Promise<NFTSnapshot> { if (!this.enabled)
        return { attachments: [], containers: [], doors: [] }; const [assets, containers, doors] = await Promise.all([this.client.readContract({ address: this.addresses.world!, abi: nftStateAbi, functionName: 'getAttachments', args: [BigInt(parcelId)] }), this.client.readContract({ address: this.addresses.world!, abi: nftStateAbi, functionName: 'getContainers', args: [BigInt(parcelId)] }), this.client.readContract({ address: this.addresses.world!, abi: nftStateAbi, functionName: 'getDoors', args: [BigInt(parcelId)] })]); return { attachments: assets.map(a => ({ asset: { chainId: this.client.chain.id, contractAddress: a.collection, tokenId: a.tokenId }, depositor: a.depositor, location: a.location.containerId ? { kind: 'container', parcelId: a.location.parcelId, containerId: a.location.containerId } : { kind: 'parcel', parcelId: a.location.parcelId, x: a.location.x, z: a.location.z, rotation: a.location.rotation } })), containers: [...containers], doors: doors.map(d => ({ ...d, requirement: d.kind === 1 ? { kind: 'erc1155', contractAddress: d.collection, tokenId: d.tokenId, minimum: d.minimum, mode: 'CHECK_ONLY' } : { kind: 'erc721', contractAddress: d.collection, tokenId: d.tokenId, mode: 'CHECK_ONLY' } })) }; }
    async approve(asset: NFTAsset) { this.asset(asset); await this.write(asset.contractAddress, nftAbi, 'approve', [this.addresses.world, asset.tokenId]); }
    private location(location: AttachedLocation) { validateLocation(location); return location.kind === 'parcel' ? { parcelId: location.parcelId, containerId: 0, x: location.x, z: location.z, rotation: location.rotation } : { parcelId: location.parcelId, containerId: location.containerId, x: 0, z: 0, rotation: 0 }; }
    async attach(asset: NFTAsset, location: AttachedLocation) { this.asset(asset); await this.write(this.addresses.world, nftStateAbi, 'attach', [asset.contractAddress, asset.tokenId, this.location(location)]); }
    async move(asset: NFTAsset, location: AttachedLocation) { this.asset(asset); await this.write(this.addresses.world, nftStateAbi, 'move', [asset.contractAddress, asset.tokenId, this.location(location)]); }
    async detach(asset: NFTAsset) { this.asset(asset); await this.write(this.addresses.world, nftStateAbi, 'detach', [asset.contractAddress, asset.tokenId]); }
    async createContainer(parcel: number, t: LocalTransform, capacity: number) { await this.write(this.addresses.world, nftStateAbi, 'createContainer', [parcel, t.x, t.z, t.rotation, capacity]); }
    async removeContainer(id: number) { await this.write(this.addresses.world, nftStateAbi, 'removeContainer', [id]); }
    async containerBalance(id: number) { return [...await this.client.readContract({ address: this.addresses.containers!, abi: containerItemAbi, functionName: 'getBalances', args: [id] })]; }
    async approveItems() { await this.write(this.addresses.items, parseAbi(['function setApprovalForAll(address,bool)']), 'setApprovalForAll', [this.addresses.containers, true]); }
    async storeItem(id: number, item: number, amount: bigint) { await this.write(this.addresses.containers, containerItemAbi, 'store', [id, item, amount]); }
    async retrieveItem(id: number, item: number, amount: bigint) { await this.write(this.addresses.containers, containerItemAbi, 'retrieve', [id, item, amount]); }
    async createDoor(parcel: number, t: LocalTransform, r: AccessRequirement) { await this.write(this.addresses.world, nftStateAbi, 'createDoor', [parcel, t.x, t.z, t.rotation, r.kind === 'erc1155' ? 1 : 2, r.contractAddress, r.tokenId, r.kind === 'erc1155' ? r.minimum : 1n]); }
    async removeDoor(parcel: number, id: number) { await this.write(this.addresses.world, nftStateAbi, 'removeDoor', [parcel, id]); }
    async canOpen(door: WorldDoor, account: Address) { return this.client.readContract({ address: this.addresses.world!, abi: nftStateAbi, functionName: 'canOpen', args: [door.parcelId, door.id, account] }); }
}
