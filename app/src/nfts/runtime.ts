import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateItemPlacement as validateTrinket} from '../trinkets/model.ts';
import type {InventoryUI} from '../items/inventoryUI.ts';
import {MountSaveError} from './mountState.ts';
import {EditionLayer} from '../editions/rendering.ts';
import {AssetPlacement} from './placement.ts';
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
import { NFTLayer, NFTRepresentationRegistry, createNFTArtwork, disposeEntity } from './rendering.ts';
import { MetadataCache, loadSafeImage } from './metadata.ts';
import { assetKey, type NFTAsset, type NFTSnapshot, type AttachedLocation, type NFTAttachment, type WorldContainer, type WorldDoor, type AccessRequirement } from './model.ts';
import { MOCK_ITEMS, MOCK_NFT_COLLECTION } from './mock.ts';
type InventoryTab = "characters" | "art" | "trinkets" | "chests" | "keys";
interface Options {
    inventory:InventoryUI;
    backend: Awaited<ReturnType<typeof createBackend>>;
    scene: THREE.Scene;
    canvas: HTMLCanvasElement;
    surfaces():THREE.Object3D[];
    height(x:number,z:number):number;
    canPlace():boolean;
    camera: THREE.Camera;
    playerPosition?:()=>THREE.Vector3;
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
    readonly editions:EditionLayer;
    private mountRetry?:()=>Promise<void>;
    readonly editionCache:MetadataCache;
    private selectedEdition:NFTAsset|null=null;
    private editionQuantity="1";
    private activeTab:InventoryTab='characters';
    private tabs=document.createElement('nav');
    private trinketHost=document.createElement('div');
    open = false;
    private placement:AssetPlacement|null=null;
    get placing(){return this.placement!==null;}
    busy = false;
    openContainer = 0;
    accessResult = '—';
    private options: Options;
    private panel = document.createElement('section');
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
        this.editionCache=new MetadataCache(a=>options.backend.editions.uri(a),options.gateway);
        this.editions=new EditionLayer(options.scene,options.backend.editions,options.seed,this.editionCache,options.report);
        this.panel.className = 'asset-panel';
        this.panel.hidden = true;
        this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Inventory');
        const heading=document.createElement('div');heading.className='menu-heading';
        heading.innerHTML='<div><div class="menu-kicker">YOUR COLLECTION · I TO CLOSE</div><h2>Inventory</h2><p>Choose an asset. Find its place in your world.</p></div>';
        const close=document.createElement('button');close.className='menu-close';close.textContent='×';close.setAttribute('aria-label','Close inventory');close.onclick=()=>this.setOpen(false);heading.append(close);
        this.content.className='menu-body';this.status.className='menu-status';this.status.setAttribute('role','status');
        this.tabs.className='inventory-tabs';this.tabs.setAttribute('aria-label','Inventory categories');
        for(const [id,label] of [['characters','Characters'],['art','NFTs'],['trinkets','Trinkets'],['chests','Chests'],['keys','Keys']] as const){const button=document.createElement('button');button.textContent=label;button.dataset.tab=id;button.onclick=()=>this.selectTab(id);this.tabs.append(button);}
        options.inventory.mount(this.trinketHost);
        this.panel.append(heading,this.tabs,this.trinketHost,this.content,this.status);
        document.getElementById('app')!.append(this.panel);this.selectTab('characters',false);
        this.label.className = 'nft-interaction-label';
        document.getElementById('app')!.append(this.label);
        this.interactions = new InteractionController({ camera: options.camera, origin:options.playerPosition, roots: () => [...this.layer.roots(),...this.editions.roots()], occluders: options.occluders, context: () => ({ connected: options.backend.wallet.snapshot.isConnected, canEdit: () => false }), enabled: () => options.enabled() && !this.open, label: this.label, report: options.report, resolve: object => {
                const kind = object.userData.kind;
                if(kind==='edition'){const a=object.userData.entity;return {id:`edition:${a.editionId}`,type:'NFT',getInteractionLabel:()=>`Inspect ${object.userData.metadata.name} × ${a.quantity}`,canInteract:()=>true,interact:async()=>{this.parcel=a.location.parcelId;this.selectedEdition=a.asset;this.selectTab('art',false);this.setOpen(true,false);}};}
                if (kind === 'nft') {
                    const a = object.userData.entity as NFTAttachment;
                    return { id: assetKey(a.asset), type: 'NFT', getInteractionLabel: () => `Inspect ${object.userData.metadata.name}`, canInteract: () => true, interact: async () => { this.parcel = a.location.parcelId; this.selected = a.asset; this.selectTab(this.isCharacter(a.asset)?'characters':'art',false); this.openContainer = 0; this.setOpen(true, false); } };
                }
                if (kind === 'container') {
                    const c = object.userData.entity as WorldContainer;
                    return { id: String(c.id), type: 'container', getInteractionLabel: () => `Open Chest #${c.id}`, canInteract: () => true, interact: async () => { this.parcel = c.parcelId; this.openContainer = c.id; this.selectTab('chests',false); this.setOpen(true, false); } };
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
        window.addEventListener('keydown', e => {
            if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof Element&&(e.target.matches('input,textarea,select')||e.target.closest('[contenteditable="true"]')))return;
            if(e.code==='KeyI'){e.preventDefault();this.setOpen(!this.open);}
            if(e.code==='Escape'&&this.open){e.preventDefault();this.setOpen(false);}
        },{signal:this.abort.signal});
        this.stopWallet = options.backend.wallet.subscribe(() => { this.openedDoors.clear(); this.restoreDoors(); if (this.open)
            void this.refresh(); });
    }
    private isCharacter(asset:NFTAsset){return asset.contractAddress.toLowerCase()===this.options.native?.toLowerCase();}
    private heading(text:string,tab:InventoryTab,parent:HTMLElement=this.content){const h=this.text(parent,text,'h3');h.dataset.inventoryTab=tab;return h;}
    private selectTab(tab:InventoryTab,refresh=true){
        if(refresh&&(this.busy||this.options.inventory.busy))return;
        if(refresh)this.status.textContent="";
        this.activeTab=tab;this.tabs.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
        this.trinketHost.hidden=tab!=='trinkets';this.content.hidden=tab==='trinkets';
        this.content.querySelectorAll<HTMLElement>('[data-inventory-tab]').forEach(section=>section.hidden=section.dataset.inventoryTab!==tab);
        if(refresh&&this.open)void this.refresh();
    }
    private previewImage(parent:HTMLElement,image?:string){
        if(!image)return;const canvas=document.createElement('canvas');canvas.className='inventory-art-preview';canvas.width=256;canvas.height=256;parent.append(canvas);
        void loadSafeImage(image).then(bitmap=>{try{if(!canvas.isConnected)return;const c=canvas.getContext('2d');if(c){const scale=Math.min(256/bitmap.width,256/bitmap.height);c.drawImage(bitmap,(256-bitmap.width*scale)/2,(256-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);}}finally{bitmap.close();}}).catch(()=>canvas.remove());
    }
    private restoreDoors() { for (const root of this.layer.roots())
        root.traverse(o => { if (o.name === 'door-panel')
            {o.visible = true;o.rotation.y=0;} }); }
    setOpen(open: boolean, reset = true) { if (this.busy && open)
        return; if(open)this.cancelPlacement(); this.open = open; this.panel.hidden = !open; if (open && reset) {
        this.parcel = this.options.token();
        this.openContainer = 0;
    } this.options.modal(open); if (open)
        void this.refresh(); }
    cancelPlacement() {if(!this.placement)return;this.placement.dispose();this.placement=null;this.options.modal(false);}
    async beginTrinketPlacement(itemType:number,quantity:bigint){
        const o=this.options,token=o.token();
        if(!this.open||!o.canPlace())throw new Error('Visit a parcel you own to place trinkets.');
        if(this.mountRetry)throw new Error('Finish or discard the pending art mount first.');
        const gltf=await new GLTFLoader().loadAsync(new URL(`../trinkets/models/${itemType}.glb`,import.meta.url).href);
        const preview=gltf.scene;
        if(!this.open||o.token()!==token||!o.canPlace()){disposeEntity(preview);return;}
        this.setOpen(false);
        this.placement=new AssetPlacement({canvas:o.canvas,camera:o.camera,scene:o.scene,surfaces:o.surfaces,height:o.height,token,preview,
            valid:()=>o.canPlace()&&o.token()===token,validate:t=>validateTrinket({itemType,quantity,...t}),cancel:()=>this.cancelPlacement(),
            place:t=>{if(this.busy)return;this.cancelPlacement();void this.run(()=>o.backend.trinkets.placeItem(token,{itemType,quantity,...t}));}});
        o.modal(true);
    }
    private async beginPlacement(asset?:NFTAsset,move=false,edition?:{quantity:bigint;id?:bigint}) {
        const o=this.options, token=o.token();
        if(this.mountRetry)throw new Error('Finish saving the pending art mount before starting another placement.');
        if(!o.canPlace())throw new Error('Visit a parcel you own to place assets.');
        const registry=new NFTRepresentationRegistry(edition?undefined:o.native);
        let preview:THREE.Group;
        try {
            if(asset){const metadata=await (edition?this.editionCache:this.cache).get(asset);preview=await registry.loadCharacter(asset)??registry.create(asset,metadata);
                if(metadata.image&&!preview.userData.characterModel)try{preview.add(createNFTArtwork(await loadSafeImage(metadata.image)));}catch{/* Pedestal remains usable. */}
            }else preview=registry.container();
        }finally{registry.dispose();}
        if(!this.open||token!==o.token()||!o.canPlace()){disposeEntity(preview);return;}
        this.setOpen(false);
        this.placement=new AssetPlacement({canvas:o.canvas,camera:o.camera,scene:o.scene,surfaces:o.surfaces,height:o.height,token,preview,onchainMount:o.backend.config.mode==='onchain',valid:()=>o.canPlace()&&o.token()===token,
            cancel:()=>this.cancelPlacement(),place:t=>{
                if(this.busy)return;
                this.cancelPlacement();
                void this.run(async()=>{if(asset&&edition){const location={parcelId:token,...t};if(edition.id!==undefined)await o.backend.editions.move(edition.id,location);else await o.backend.editions.attach(asset,edition.quantity,location);}else if(asset){const location={kind:'parcel' as const,parcelId:token,...t};if(move)await o.backend.nfts.move(asset,location);else await o.backend.nfts.attach(asset,location);}else await o.backend.nfts.createContainer(token,t,16);});
            }});
        o.modal(true);
    }
    private text(parent: HTMLElement, text: string, tag = 'p') { const node = document.createElement(tag); node.textContent = text; parent.append(node); return node; }
    private action(parent: HTMLElement, text: string, fn: () => Promise<void>) { const b = document.createElement('button'); b.textContent = text; b.disabled = this.busy; b.onclick = () => { void this.run(fn); }; parent.append(b); return b; }
    private input(parent: HTMLElement, label: string, value: string) { const wrapper = document.createElement('label'); wrapper.textContent = label; const input = document.createElement('input'); input.value = value; wrapper.append(input); parent.append(wrapper); return input; }
    private near(c: WorldContainer) { const p = objectToWorldPosition(c.parcelId, c); if (Math.hypot(p.x - (this.options.playerPosition?.()??this.options.camera.position).x, p.z - (this.options.playerPosition?.()??this.options.camera.position).z) > 5)
        throw new Error('Approach within 5 units to open this container'); }
    private ahead() { const direction = this.options.camera.getWorldDirection(new THREE.Vector3()); direction.y = 0; direction.normalize(); const p = this.options.camera.position.clone().addScaledVector(direction, 3); return { ...worldToObjectPosition(this.options.token(), p.x, p.z), rotation: Math.round((Math.atan2(-direction.x, -direction.z) * 180 / Math.PI + 360) % 360 * 100) % 36000 }; }
    private async run(fn: () => Promise<void>) { if (this.busy)
        return; this.busy = true; this.content.querySelectorAll('button').forEach(b => b.disabled = true); this.status.textContent = 'Pending — confirm the wallet transaction if requested.'; try {
        await fn();
        await this.refreshWorld();
        this.options.changed();
        this.status.textContent = 'Confirmed.';if(!this.open&&!this.placing)this.options.report('Asset change confirmed.');
    }
    catch (error) {
        if(error instanceof MountSaveError){this.mountRetry=error.retry;await this.refreshWorld();this.options.changed();}
        this.status.textContent = error instanceof Error ? error.message.slice(0, 300) : String(error);if(!this.open)this.options.report(this.status.textContent);
    }
    finally {
        this.busy = false;
        await this.refresh();
    } }
    async refresh() {
        const request = ++this.request, o = this.options;
        if(this.activeTab==='trinkets'){await o.inventory.refresh();return;}
        const previousStatus=this.status.textContent;this.status.textContent='Loading inventory…';
        try {
            const snapshot = await o.backend.nfts.snapshot(this.parcel);
            const owner = (await o.backend.world.getParcel(this.parcel)).owner;
            const account = o.backend.wallet.snapshot.connectedAddress;
            const controlled = !!account && owner?.toLowerCase() === account.toLowerCase();
            const known = account&&this.activeTab==='characters' ? await o.backend.nfts.ownedCharacters?.(account)??o.backend.nfts.knownAssets() : [];
            const holdings = await Promise.all(known.map(async (asset) => ({ asset, owner: await o.backend.nfts.ownerOf(asset).catch(() => null) })));
            if (request !== this.request)
                return;
            this.content.replaceChildren();
            if(this.mountRetry){
                this.text(this.content,'The NFT is already placed. Finish saving its mount, or discard this pending mount and reposition it.');
                this.action(this.content,'Finish saving art mount',async()=>{await this.mountRetry!();this.mountRetry=undefined;});
                this.action(this.content,'Discard pending mount',async()=>{this.mountRetry=undefined;});
            }
            this.text(this.content, `PARCEL #${this.parcel}`, 'h2');
            this.text(this.content,account?`${account.slice(0,6)}…${account.slice(-4)} · ${controlled?'You own this parcel':'Visit your own parcel to place assets'}`:'Connect your wallet to manage your collection.');
            if(!account)this.action(this.content,'Connect wallet',async()=>{await o.backend.wallet.connect();});

            if (!o.backend.nfts.enabled) {
                this.text(this.content, 'Configure NFT custody contracts to enable attachments.');
                return;
            }
            if(o.native){
                this.heading('Find a character','characters');
                this.text(this.content,'Select one of your wallet characters below, or look up its token ID. Approve it, then choose its position in the world.');
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
            this.heading('Your characters','characters');
            for (const entry of holdings.filter(e => !!account && e.owner?.toLowerCase() === account.toLowerCase()))
                this.action(this.content, `Select character #${entry.asset.tokenId}`, async () => { this.selected = entry.asset; });
            this.heading('Add an NFT · ERC-721','art');
            const contract = this.input(this.content, 'Collection address', this.selected?.contractAddress ?? ''), token = this.input(this.content, 'Token ID', this.selected ? String(this.selected.tokenId) : '');
            this.action(this.content, 'Inspect pasted NFT', async () => { if (!/^\d+$/.test(token.value))
                throw new Error('Enter a non-negative token ID'); this.selected = { chainId: o.backend.config.chainId, contractAddress: getAddress(contract.value.trim()), tokenId: BigInt(token.value) }; assetKey(this.selected); await o.backend.nfts.ownerOf(this.selected); });
            for(const tab of ['characters','art'] as const){
                this.heading(tab==='characters'?'Placed characters':'Placed NFTs',tab);
                const rows=snapshot.attachments.filter(a=>this.isCharacter(a.asset)===(tab==='characters'));
                if(!rows.length)this.text(this.content,'Nothing placed on this parcel yet.');
                for(const a of rows)this.action(this.content,`Select #${a.asset.tokenId} · ${a.location.kind==='container'?`Chest #${a.location.containerId}`:'On parcel'}`,async()=>{this.selected=a.asset;this.selectTab(tab,false);});
            }
            this.heading('Chest storage',this.selected&&this.isCharacter(this.selected)?'characters':'art');
            const container=document.createElement('select');container.setAttribute('aria-label','Destination chest');container.append(new Option('Choose a chest…','0'));
            for(const c of snapshot.containers)container.append(new Option(`Chest #${c.id} (${c.occupied}/${c.capacity})`,String(c.id)));
            container.value=String(this.openContainer);this.content.append(container);
            this.text(this.content,'Use Place in world to position an NFT. Choose a chest here only when storing it.');
            const target=():AttachedLocation=>{if(!Number(container.value))throw new Error('Choose a destination chest first.');return {kind:'container',parcelId:this.parcel,containerId:Number(container.value)};};
            if (this.selected) {
                const asset = this.selected, metadata = await this.cache.get(asset), custodian = await o.backend.nfts.ownerOf(asset).catch(() => null);
                if (request !== this.request)
                    return;
                this.heading(metadata.name,this.isCharacter(asset)?'characters':'art');this.previewImage(this.content,metadata.image);
                const details=document.createElement('details');details.className='asset-details';const summary=document.createElement('summary');summary.textContent='NFT details & traits';details.append(summary);this.content.append(details);
                this.text(details, `Collection: ${asset.contractAddress} · Token: ${asset.tokenId} · Chain: ${asset.chainId}`);
                this.text(details, `Custodian: ${custodian ?? 'unavailable'}`);
                const attached = snapshot.attachments.find(a => assetKey(a.asset) === assetKey(asset));
                this.text(this.content, attached ? `Canonical location: ${attached.location.kind} / parcel #${attached.location.parcelId}${attached.location.kind === 'container' ? ` / chest #${attached.location.containerId}` : ''}` : 'No attachment in this parcel');
                this.text(details, metadata.description);
                for (const trait of metadata.attributes)
                    this.text(details, `${trait.trait_type}: ${trait.value}`);
                if(!account){
                    this.text(this.content,'Connect the wallet holding this NFT to approve and place it.');
                    this.action(this.content,'Connect wallet to place this NFT',async()=>{await o.backend.wallet.connect();});
                }else if(custodian&&custodian.toLowerCase()!==account.toLowerCase()&&!attached){
                    this.text(this.content,`Connected wallet ${account} does not hold this NFT. Connect its custodian wallet to place it.`);
                }else if(!custodian){
                    this.text(this.content,'NFT ownership could not be checked. Retry inspection before placing.');
                }
                if (account && custodian?.toLowerCase() === account.toLowerCase()) {
                    const character=!!o.native&&asset.contractAddress.toLowerCase()===o.native.toLowerCase();
                    this.action(this.content, character?'1. Approve character':'1. Approve this NFT only', () => o.backend.nfts.approve(asset));
                    if(controlled&&this.parcel===o.token())this.action(this.content,'2. Place in world',()=>this.beginPlacement(asset));
                    if(!controlled)this.text(this.content,'Visit a parcel you own to place this NFT. Approval alone does not grant parcel access.');
                    if (controlled&&snapshot.containers.length)
                        this.action(this.content, 'Store in selected chest', () => o.backend.nfts.attach(asset, target()));
                }
                if (attached && controlled) {
                    if(this.parcel===o.token())this.action(this.content,'Reposition in world',()=>this.beginPlacement(asset,true));
                    if(snapshot.containers.length)this.action(this.content, 'Move into selected chest', () => o.backend.nfts.move(asset, target()));
                    this.action(this.content, 'Detach into my wallet', () => o.backend.nfts.detach(asset));
                }
            }
            await this.renderEditions(this.content,controlled,request);
            if(request!==this.request)return;
            this.heading('Chests on this parcel','chests');
            if (controlled)
                this.action(this.content, 'Place chest · choose a spot', () => this.beginPlacement());
            for (const c of snapshot.containers) {
                this.action(this.content, `Open chest #${c.id} · ${c.occupied}/${c.capacity}`, async () => { this.near(c); this.openContainer = c.id; });
                if (controlled)
                    this.action(this.content, `Remove chest #${c.id}`, () => o.backend.nfts.removeContainer(c.id));
            }
            const opened = snapshot.containers.find(c => c.id === this.openContainer);
            if (opened) {
                const balances = await o.backend.nfts.containerBalance(opened.id);
                if(request!==this.request)return;
                this.heading(`Inside chest #${opened.id}`,'chests');
                const stored=snapshot.attachments.filter(a=>a.location.kind==='container'&&a.location.containerId===opened.id);
                if(!stored.length)this.text(this.content,'No NFTs stored here.');
                for(const a of stored)this.action(this.content,`Manage NFT #${a.asset.tokenId}`,async()=>{this.selected=a.asset;this.selectTab(this.isCharacter(a.asset)?'characters':'art',false);});
                // Existing deposits must remain recoverable even though new Parcel Item deposits are retired.
                if(controlled)balances.forEach((balance,i)=>{if(balance>0n)this.action(this.content,`Recover previously stored item #${i+1} × ${balance}`,()=>{this.near(opened);return o.backend.nfts.retrieveItem(opened.id,i+1,balance);});});
            }
            this.heading('Doors & keys','keys');
            if (controlled) {
                this.text(this.content,'Place locked doors through Build. Manage their keys here.');
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
                this.heading('Development ownership controls','keys');
                this.action(this.content, 'Use Alice', async () => { await (o.backend.wallet as MockWallet).useAddress(o.backend.config.mockAddress); });
                this.action(this.content, 'Use Bob', async () => { await (o.backend.wallet as MockWallet).useAddress('0x2222222222222222222222222222222222222222'); });
                if (controlled) {
                    this.action(this.content, 'Transfer this parcel to Bob', () => o.backend.transferMockParcel!(this.parcel, '0x2222222222222222222222222222222222222222'));
                    this.action(this.content, 'Transfer this parcel to Alice', () => o.backend.transferMockParcel!(this.parcel, o.backend.config.mockAddress));
                }
            }
            let section: HTMLElement | null = null;
            for(const node of Array.from(this.content.children)) {
                if(node.tagName==='H3') {
                    const advanced=['Find a character','Development ownership controls','Chest storage'].includes(node.textContent??'');
                    section=document.createElement(advanced?'details':'section');section.className='menu-card';section.dataset.inventoryTab=(node as HTMLElement).dataset.inventoryTab??'art';
                    this.content.insertBefore(section,node);
                    if(advanced){const summary=document.createElement('summary');summary.textContent=node.textContent;section.append(summary);node.remove();}
                    else section.append(node);
                } else if(section) section.append(node);
            }
            this.selectTab(this.activeTab,false);this.status.textContent=previousStatus;
        }
        catch (error) {
            this.status.textContent = String(error).slice(0, 300);
        }
    }
    private async renderEditions(parent:HTMLElement,controlled:boolean,request:number){
        const o=this.options,p=o.backend.editions,account=o.backend.wallet.snapshot.connectedAddress;
        this.heading('Add an edition · ERC-1155','art',parent);
        this.text(parent,'For BasePaint and other ERC-1155 collections. Place an edition on the parcel or retrieve it into your wallet.');
        const collection=this.input(parent,'ERC-1155 collection address',this.selectedEdition?.contractAddress??''),id=this.input(parent,'Edition token ID',this.selectedEdition?String(this.selectedEdition.tokenId):'');
        const quantity=this.input(parent,'Edition quantity',this.editionQuantity);quantity.inputMode='numeric';
        this.action(parent,'Inspect ERC-1155 edition',async()=>{if(!/^\d+$/.test(id.value))throw new Error('Enter a valid token ID');if(!/^[1-9]\d*$/.test(quantity.value)||BigInt(quantity.value)>=1n<<256n)throw new Error('Enter a positive quantity');const a={chainId:o.backend.config.chainId,contractAddress:getAddress(collection.value.trim()),tokenId:BigInt(id.value)};assetKey(a);await p.uri(a);this.selectedEdition=a;this.editionQuantity=quantity.value;});
        if(!p.enabled)this.text(parent,'ERC-1155 inspection is available. Placement will be enabled after WorldEditionState is deployed and configured.');
        if(this.selectedEdition){
            const a=this.selectedEdition,[metadata,balance,approved]=await Promise.all([this.editionCache.get(a),account?p.balance(a,account).catch(()=>null):Promise.resolve(0n),account?p.approved(a,account).catch(()=>false):Promise.resolve(false)]);
            if(request!==this.request)return;
            this.heading(metadata.name,'art',parent);this.previewImage(parent,metadata.image);this.text(parent,`${a.contractAddress} · #${a.tokenId} · Wallet balance: ${balance??'unavailable'}`);this.text(parent,metadata.description);
            if(account&&balance!==null&&balance>0n&&p.enabled&&controlled){
                if(!approved){this.text(parent,'ERC-1155 approval authorizes this escrow for all editions in this collection. Approve only if you intend to attach; you can revoke it later in your wallet.');this.action(parent,'1. Approve collection for edition escrow',()=>p.approve(a));}
                const place=this.action(parent,'2. Choose edition placement',()=>{const raw=quantity.value;if(!/^[1-9]\d*$/.test(raw)||BigInt(raw)>balance)throw new Error('Quantity exceeds wallet balance or is invalid');this.editionQuantity=raw;return this.beginPlacement(a,false,{quantity:BigInt(raw)});});place.disabled=this.busy||!approved;
            }
        }
        const rows=await p.snapshot(this.parcel);if(request!==this.request)return;
        this.heading(`Placed editions · ${rows.length}`,'art',parent);
        for(const row of rows){this.text(parent,`#${row.asset.tokenId} × ${row.quantity} · ${row.asset.contractAddress}`);
            this.action(parent,'Inspect placed edition',async()=>{this.selectedEdition=row.asset;});
            if(controlled){this.action(parent,'Reposition edition',()=>this.beginPlacement(row.asset,true,{quantity:row.quantity,id:row.id}));this.action(parent,'Collect edition into my wallet',()=>p.detach(row.id));}
        }
    }
    async refreshWorld() { this.openedDoors.clear(); this.restoreDoors(); await Promise.all([...this.options.ids()].map(async id => {await Promise.all([this.layer.refresh(id),this.editions.refresh(id)]);})); }
    sync() { this.layer.sync(this.options.ids());this.editions.sync(this.options.ids()); }
    update() { this.placement?.update();this.layer.updateGrounding(this.options.height,this.options.surfaces());this.editions.updateGrounding(this.options.height,this.options.surfaces()); this.interactions.update(); for (const root of this.layer.roots())
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
    dispose() { this.cancelPlacement();this.request++; this.stopWallet(); this.abort.abort(); this.interactions.dispose(); this.layer.dispose();this.editions.dispose(); this.panel.remove();  this.label.remove(); }
}
