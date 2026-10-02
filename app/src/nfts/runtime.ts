import {characterAsset} from './characters.ts';
import { localPoint } from '../objects/building.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { EYE_HEIGHT } from '../world/constants.ts';
import * as THREE from 'three';
import { getAddress, type Address } from 'viem';
import type { createBackend } from '../blockchain/backend.ts';
import { MockWallet } from '../blockchain/mockWallet.ts';
import { worldToObjectPosition, objectToWorldPosition } from '../objects/model.ts';
import { InteractionController } from '../interactions/controller.ts';
import { NFTLayer, NFTRepresentationRegistry } from './rendering.ts';
import { MetadataCache } from './metadata.ts';
import { assetKey, type NFTAsset, type NFTSnapshot, type AttachedLocation, type NFTAttachment, type WorldContainer, type WorldDoor, type AccessRequirement } from './model.ts';
import { MOCK_ITEMS, MOCK_NFT_COLLECTION } from './mock.ts';
interface Options {
    backend: Awaited<ReturnType<typeof createBackend>>;
    scene: THREE.Scene;
    camera: THREE.Camera;
    seed: bigint;
    ids(): Iterable<number>;
    token(): number;
    enabled(): boolean;
    modal(active: boolean): void;
    report(message: string): void;
    changed(): void;
    occluders(): THREE.Object3D[];
    gateway: string;
    native?: string;
    items?: Address;
}
/** DOM controls and interactables live here, not inside the render loop. */
export class NFTRuntime {
    readonly layer: NFTLayer;
    readonly cache: MetadataCache;
    open = false;
    busy = false;
    openContainer = 0;
    accessResult = '—';
    private options: Options;
    private panel = document.createElement('section');
    private button = document.createElement('button');
    private status = document.createElement('p');
    private content = document.createElement('div');
    private label = document.createElement('div');
    private abort = new AbortController();
    private interactions: InteractionController;
    private selected: NFTAsset | null = null;
    private parcel: number;
    private openedDoors = new Set<string>();
    private stopWallet: () => void;
    private request = 0;
    constructor(options: Options) {
        this.options = options;
        this.parcel = options.token();
        this.cache = new MetadataCache(a => options.backend.nfts.tokenURI(a), options.gateway);
        this.layer = new NFTLayer(options.scene, options.backend.nfts, new NFTRepresentationRegistry(options.native), options.seed, this.cache, options.report);
        this.button.textContent = 'Characters / NFTs / Containers';
        this.button.className = 'assets-button';
        this.button.addEventListener('click', () => this.setOpen(!this.open));
        this.panel.className = 'asset-panel';
        this.panel.hidden = true;
        this.panel.append(this.content, this.status);
        document.getElementById('app')!.append(this.button, this.panel);
        this.label.className = 'nft-interaction-label';
        document.getElementById('app')!.append(this.label);
        this.interactions = new InteractionController({ camera: options.camera, roots: () => this.layer.roots(), occluders: options.occluders, context: () => ({ connected: options.backend.wallet.snapshot.isConnected, canEdit: () => false }), enabled: () => options.enabled() && !this.open, label: this.label, report: options.report, resolve: object => {
                const kind = object.userData.kind;
                if (kind === 'nft') {
                    const a = object.userData.entity as NFTAttachment;
                    return { id: assetKey(a.asset), type: 'NFT', getInteractionLabel: () => `Inspect ${object.userData.metadata.name}`, canInteract: () => true, interact: async () => { this.parcel = a.location.parcelId; this.selected = a.asset; this.openContainer = 0; this.setOpen(true, false); } };
                }
                if (kind === 'container') {
                    const c = object.userData.entity as WorldContainer;
                    return { id: String(c.id), type: 'container', getInteractionLabel: () => `Open Chest #${c.id}`, canInteract: () => true, interact: async () => { this.parcel = c.parcelId; this.openContainer = c.id; this.setOpen(true, false); } };
                }
                if (kind === 'door') {
                    const d = object.userData.entity as WorldDoor;
                    return { id: String(d.id), type: 'door', getInteractionLabel: () => this.openedDoors.has(`${d.parcelId}:${d.id}`)?`Close door #${d.id}`:`Check / open door #${d.id}`, canInteract: () => true, interact: async () => { const key=`${d.parcelId}:${d.id}`;
                        const account=options.backend.wallet.snapshot.connectedAddress;
                        const allowed=!!account&&await options.backend.nfts.canOpen(d,account);
                        if(account!==options.backend.wallet.snapshot.connectedAddress)return;
                        this.accessResult=allowed?'Access granted (CHECK_ONLY)':'Requires the key in your wallet';options.report(this.accessResult);
                        if(!allowed)return;
                        if(this.openedDoors.has(key))this.openedDoors.delete(key);else this.openedDoors.add(key);
                    } };

                }
                return null;
            } });
        window.addEventListener('keydown', e => { if (e.code === 'Escape' && this.open) {
            e.preventDefault();
            this.setOpen(false);
        } }, { signal: this.abort.signal });
        this.stopWallet = options.backend.wallet.subscribe(() => { this.openedDoors.clear(); this.restoreDoors(); if (this.open)
            void this.refresh(); });
    }
    private restoreDoors() { for (const root of this.layer.roots())
        root.traverse(o => { if (o.name === 'door-panel')
            {o.visible = true;o.rotation.y=0;} }); }
    setOpen(open: boolean, reset = true) { if (this.busy)
        return; this.open = open; this.panel.hidden = !open; if (open && reset) {
        this.parcel = this.options.token();
        this.openContainer = 0;
    } this.options.modal(open); if (open)
        void this.refresh(); }
    private text(parent: HTMLElement, text: string, tag = 'p') { const node = document.createElement(tag); node.textContent = text; parent.append(node); return node; }
    private action(parent: HTMLElement, text: string, fn: () => Promise<void>) { const b = document.createElement('button'); b.textContent = text; b.disabled = this.busy; b.onclick = () => { void this.run(fn); }; parent.append(b); return b; }
    private input(parent: HTMLElement, label: string, value: string) { const wrapper = document.createElement('label'); wrapper.textContent = label; const input = document.createElement('input'); input.value = value; wrapper.append(input); parent.append(wrapper); return input; }
    private near(c: WorldContainer) { const p = objectToWorldPosition(c.parcelId, c); if (Math.hypot(p.x - this.options.camera.position.x, p.z - this.options.camera.position.z) > 5)
        throw new Error('Approach within 5 units to open this container'); }
    private ahead() { const direction = this.options.camera.getWorldDirection(new THREE.Vector3()); direction.y = 0; direction.normalize(); const p = this.options.camera.position.clone().addScaledVector(direction, 3); return { ...worldToObjectPosition(this.options.token(), p.x, p.z), rotation: Math.round((Math.atan2(-direction.x, -direction.z) * 180 / Math.PI + 360) % 360 * 100) % 36000 }; }
    private async run(fn: () => Promise<void>) { if (this.busy)
        return; this.busy = true; this.panel.querySelectorAll('button').forEach(b => b.disabled = true); this.status.textContent = 'Pending — confirm the wallet transaction if requested.'; try {
        await fn();
        await this.refreshWorld();
        this.options.changed();
        this.status.textContent = 'Confirmed.';
    }
    catch (error) {
        this.status.textContent = error instanceof Error ? error.message.slice(0, 300) : String(error);
    }
    finally {
        this.busy = false;
        await this.refresh();
    } }
    async refresh() {
        const request = ++this.request, o = this.options;
        try {
            const snapshot = await o.backend.nfts.snapshot(this.parcel);
            const owner = (await o.backend.world.getParcel(this.parcel)).owner;
            const account = o.backend.wallet.snapshot.connectedAddress;
            const controlled = !!account && owner?.toLowerCase() === account.toLowerCase();
            const known = o.backend.nfts.knownAssets();
            const holdings = await Promise.all(known.map(async (asset) => ({ asset, owner: await o.backend.nfts.ownerOf(asset).catch(() => null) })));
            if (request !== this.request)
                return;
            this.content.replaceChildren();
            this.text(this.content, `NFT ASSETS · PARCEL #${this.parcel}`, 'h2');
            this.text(this.content, `Controller: ${owner ?? 'unminted'} · Wallet: ${account ?? 'disconnected'}`);
            this.action(this.content, 'Close [Esc]', async () => { this.busy = false; this.setOpen(false); });
            if (!o.backend.nfts.enabled) {
                this.text(this.content, 'Configure NFT custody contracts to enable attachments.');
                return;
            }
            if(o.native){
                this.text(this.content,'Doodverse Characters','h3');
                this.text(this.content,'Choose your minted character (1–5000), approve it, then place it ahead on your parcel. Attached characters transfer with the land; the current parcel owner can retrieve them.');
                const characterId=this.input(this.content,'Character token ID',this.selected?.contractAddress.toLowerCase()===o.native.toLowerCase()?String(this.selected.tokenId):'1');
                characterId.inputMode='numeric';
                this.action(this.content,'Select my character',async()=>{
                    const asset=characterAsset(o.backend.config.chainId,o.native!,characterId.value.trim());
                    const wallet=o.backend.wallet.snapshot.connectedAddress;
                    if(!wallet)throw new Error('Connect your wallet first.');
                    const owner=await o.backend.nfts.ownerOf(asset);
                    if(owner.toLowerCase()!==wallet.toLowerCase())throw new Error('This character is not in your wallet. Check its ID or inspect it under Attached NFTs.');
                    this.selected=asset;
                });
            }
            this.text(this.content, 'Wallet NFTs', 'h3');
            for (const entry of holdings.filter(e => e.owner?.toLowerCase() === account?.toLowerCase()))
                this.action(this.content, `Select character #${entry.asset.tokenId}`, async () => { this.selected = entry.asset; });
            const contract = this.input(this.content, 'Collection address', this.selected?.contractAddress ?? ''), token = this.input(this.content, 'Token ID', this.selected ? String(this.selected.tokenId) : '');
            this.action(this.content, 'Inspect pasted NFT', async () => { if (!/^\d+$/.test(token.value))
                throw new Error('Enter a non-negative token ID'); this.selected = { chainId: o.backend.config.chainId, contractAddress: getAddress(contract.value.trim()), tokenId: BigInt(token.value) }; assetKey(this.selected); await o.backend.nfts.ownerOf(this.selected); });
            this.text(this.content, 'Attached NFTs', 'h3');
            for (const a of snapshot.attachments)
                this.action(this.content, `Inspect #${a.asset.tokenId} · ${a.location.kind}${a.location.kind === 'container' ? ` #${a.location.containerId}` : ''}`, async () => { this.selected = a.asset; });
            const destination = this.input(this.content, 'Destination parcel', String(this.parcel));
            const container = document.createElement('select');
            container.append(new Option('Parcel floor', '0'));
            for (const c of snapshot.containers)
                container.append(new Option(`Chest #${c.id} (${c.occupied}/${c.capacity})`, String(c.id)));
            container.value = String(this.openContainer);
            this.content.append(container);
            const ahead = this.parcel === o.token() ? this.ahead() : { x: 3200, z: 3200, rotation: 0 };
            const x = this.input(this.content, 'Local X (centimeters)', String(ahead.x)), z = this.input(this.content, 'Local Z (centimeters)', String(ahead.z));
            const rotation = this.input(this.content, 'Rotation (hundredths of degree)', String(ahead.rotation));
            const target = (): AttachedLocation => Number(container.value) ? { kind: 'container', parcelId: Number(destination.value), containerId: Number(container.value) } : { kind: 'parcel', parcelId: Number(destination.value), x: Number(x.value), z: Number(z.value), rotation: Number(rotation.value) };
            if (this.selected) {
                const asset = this.selected, metadata = await this.cache.get(asset), custodian = await o.backend.nfts.ownerOf(asset).catch(() => null);
                if (request !== this.request)
                    return;
                this.text(this.content, metadata.name, 'h3');
                this.text(this.content, `Collection: ${asset.contractAddress} · Token: ${asset.tokenId} · Chain: ${asset.chainId}`);
                this.text(this.content, `Custodian: ${custodian ?? 'unavailable'}`);
                const attached = snapshot.attachments.find(a => assetKey(a.asset) === assetKey(asset));
                this.text(this.content, attached ? `Canonical location: ${attached.location.kind} / parcel #${attached.location.parcelId}${attached.location.kind === 'container' ? ` / chest #${attached.location.containerId}` : ''}` : 'No attachment in this parcel');
                this.text(this.content, metadata.description);
                for (const trait of metadata.attributes)
                    this.text(this.content, `${trait.trait_type}: ${trait.value}`);
                if (custodian?.toLowerCase() === account?.toLowerCase()) {
                    const character=!!o.native&&asset.contractAddress.toLowerCase()===o.native.toLowerCase();
                    this.action(this.content, character?'1. Approve character':'1. Approve this NFT only', () => o.backend.nfts.approve(asset));
                    if(character&&controlled&&this.parcel===o.token())this.action(this.content,'2. Place character near me',()=>o.backend.nfts.attach(asset,{kind:'parcel',parcelId:o.token(),...this.ahead()}));
                    if(character&&!controlled)this.text(this.content,'Visit a parcel you own to place this character.');
                    if (controlled)
                        this.action(this.content, '2. Attach NFT at destination', () => o.backend.nfts.attach(asset, target()));
                }
                if (attached && controlled) {
                    this.action(this.content, 'Move / store at destination', () => o.backend.nfts.move(asset, target()));
                    this.action(this.content, 'Detach into my wallet', () => o.backend.nfts.detach(asset));
                }
            }
            this.text(this.content, 'Containers', 'h3');
            if (controlled)
                this.action(this.content, 'Place chest ahead (16 asset slots)', () => o.backend.nfts.createContainer(o.token(), this.ahead(), 16));
            for (const c of snapshot.containers) {
                this.action(this.content, `Open chest #${c.id} · ${c.occupied}/${c.capacity}`, async () => { this.near(c); this.openContainer = c.id; });
                if (controlled)
                    this.action(this.content, `Remove chest #${c.id}`, () => o.backend.nfts.removeContainer(c.id));
            }
            const opened = snapshot.containers.find(c => c.id === this.openContainer);
            if (opened) {
                const balances = await o.backend.nfts.containerBalance(opened.id);
                const walletItems = account ? await o.backend.experience.getInventory(account) : [];
                if (request !== this.request)
                    return;
                this.text(this.content, `PLAYER INVENTORY ↔ CHEST #${opened.id}`, 'h3');
                for (let i = 0; i < 6; i++)
                    this.text(this.content, `Item ${i + 1}: wallet ${walletItems.find(v => v.itemId === i + 1)?.balance ?? 0n} · chest ${balances[i]}`);
                for (const a of snapshot.attachments.filter(a => a.location.kind === 'container' && a.location.containerId === opened.id))
                    this.text(this.content, `NFT ${a.asset.contractAddress} #${a.asset.tokenId}`);
                if (controlled) {
                    const item = this.input(this.content, 'Item type (1–6)', '3'), amount = this.input(this.content, 'Quantity', '1');
                    this.action(this.content, 'Approve container item escrow', () => o.backend.nfts.approveItems());
                    this.action(this.content, 'Store items', () => { this.near(opened); return o.backend.nfts.storeItem(opened.id, Number(item.value), BigInt(amount.value)); });
                    this.action(this.content, 'Retrieve items', () => { this.near(opened); return o.backend.nfts.retrieveItem(opened.id, Number(item.value), BigInt(amount.value)); });
                }
            }
            this.text(this.content, 'CHECK_ONLY doors', 'h3');
            if (controlled) {
                const kind = document.createElement('select');
                kind.append(new Option('ERC-1155 balance', 'erc1155'), new Option('Exact ERC-721 ownership', 'erc721'));
                this.content.append(kind);
                const collection = this.input(this.content, 'Requirement contract', o.items ?? MOCK_ITEMS), id = this.input(this.content, 'Required token / item ID', '4');
                this.action(this.content, 'Place custom requirement door ahead', () => { const r: AccessRequirement = kind.value === 'erc1155' ? { kind: 'erc1155', contractAddress: getAddress(collection.value), tokenId: BigInt(id.value), minimum: 1n, mode: 'CHECK_ONLY' } : { kind: 'erc721', contractAddress: getAddress(collection.value), tokenId: BigInt(id.value), mode: 'CHECK_ONLY' }; return o.backend.nfts.createDoor(o.token(), this.ahead(), r); });
                for (const d of snapshot.doors) {
                    this.action(this.content, `Remove door #${d.id}`, () => o.backend.nfts.removeDoor(d.parcelId, d.id));
                    if(o.backend.nfts.lockKeys?.toLowerCase()===d.requirement.contractAddress.toLowerCase()) {
                        this.text(this.content,`Door #${d.id} · Key #${d.requirement.tokenId}. Keys expire on rekey or parcel transfer.`);
                        this.action(this.content,'Rekey this door',()=>o.backend.nfts.rekeyDoor!(d.parcelId,d.id));
                        const to=this.input(this.content,'Give a key copy to','');
                        this.action(this.content,'Issue key copy',()=>o.backend.nfts.issueKeyCopies!(d.requirement.tokenId,getAddress(to.value),1n));
                    }
                }
            }
            if (o.backend.transferMockParcel) {
                this.text(this.content, 'Development ownership controls', 'h3');
                this.action(this.content, 'Use Alice', async () => { await (o.backend.wallet as MockWallet).useAddress(o.backend.config.mockAddress); });
                this.action(this.content, 'Use Bob', async () => { await (o.backend.wallet as MockWallet).useAddress('0x2222222222222222222222222222222222222222'); });
                if (controlled) {
                    this.action(this.content, 'Transfer this parcel to Bob', () => o.backend.transferMockParcel!(this.parcel, '0x2222222222222222222222222222222222222222'));
                    this.action(this.content, 'Transfer this parcel to Alice', () => o.backend.transferMockParcel!(this.parcel, o.backend.config.mockAddress));
                }
            }
        }
        catch (error) {
            this.status.textContent = String(error).slice(0, 300);
        }
    }
    async refreshWorld() { this.openedDoors.clear(); this.restoreDoors(); await Promise.all([...this.options.ids()].map(id => this.layer.refresh(id))); }
    sync() { this.layer.sync(this.options.ids()); }
    update() { this.interactions.update(); for (const root of this.layer.roots())
        root.traverse(o => { if (o.userData.kind === 'door') {
            const door = o.userData.entity as WorldDoor;
            const panel = o.getObjectByName('door-panel');
            if (panel)
                {panel.visible=true;const target=this.openedDoors.has(`${door.parcelId}:${door.id}`)?-Math.PI/2:0;panel.rotation.y+=(target-panel.rotation.y)*.18;}
        } }); }
    blocks(position: THREE.Vector3) { for (const entry of this.layer.parcels.values())
        for (const d of entry.snapshot.doors) {
            if (this.openedDoors.has(`${d.parcelId}:${d.id}`))
                continue;
            const p = objectToWorldPosition(d.parcelId, d);
            const local=localPoint(position.x,position.z,p.x,p.z,d.rotation),base=d.y===undefined?getGroundHeight(p.x,p.z,this.options.seed):d.y/100,feet=position.y-EYE_HEIGHT;
            if (Math.abs(local.x)<1.18 && Math.abs(local.z)<.4 && feet<base+2.8 && feet+1.65>base)
                return true;
        } return false; }
    debug() { const snapshots = [...this.layer.parcels.values()].map(e => e.snapshot); const attachments = snapshots.flatMap(s => s.attachments); const focused = attachments.find(a => assetKey(a.asset) === this.interactions.focused?.id); const container = snapshots.flatMap(s => s.containers).find(c => c.id === this.openContainer); return `\nATTACHED721 ${attachments.length}\nNFT ENTITIES ${attachments.filter(a => a.location.kind === 'parcel').length}\nNFT FOCUS   ${focused ? assetKey(focused.asset) : 'none'}\nCUSTODY     ${focused ? 'WorldNFTState escrow' : '—'}\nCANONICAL   ${focused ? `${focused.location.kind} / #${focused.location.parcelId}` : '—'}\nCONTAINER   ${this.openContainer || 'none'} · ${container?.occupied ?? 0} assets\nACCESS      ${this.accessResult}\nMETA CACHE  ${this.cache.hits} hits / ${this.cache.misses} misses`; }
    dispose() { this.request++; this.stopWallet(); this.abort.abort(); this.interactions.dispose(); this.layer.dispose(); this.panel.remove(); this.button.remove(); this.label.remove(); }
}
