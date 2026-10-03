import {wallMount,setArtMounted} from './artMount.ts';
import {CharacterModels} from './characters.ts';
import { createLockedDoor } from '../objects/door.ts';
import * as THREE from 'three';
import { objectToWorldPosition } from '../objects/model.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { assetKey, type NFTAsset, type NFTSnapshot, type NFTStateProvider } from './model.ts';
import { MetadataCache, loadSafeImage, type SafeMetadata } from './metadata.ts';
import { createChest } from '../objects/chest.ts';
export interface NFTRepresentation {
    supports(asset: NFTAsset, metadata: SafeMetadata): boolean;
    createObject(asset: NFTAsset, metadata: SafeMetadata): THREE.Group;
}
export function disposeEntity(group: THREE.Object3D) { group.traverse(o => { if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose(); if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
    if (o instanceof THREE.Mesh)
        o.geometry.dispose();
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        const map = (material as THREE.MeshBasicMaterial).map;
        if (map) {
            const image = map.image as ImageBitmap;
            if (typeof image?.close === 'function')
                image.close();
            map.dispose();
        }
        material.dispose();
    }
} }); group.removeFromParent(); group.clear(); }
const box = (w: number, h: number, d: number, color: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color })); m.position.y = y; return m; };
/** Two outward-facing pictures clear the opaque frame; the rear image is not mirrored. */
export function createNFTArtwork(bitmap: ImageBitmap) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -.65, -.65, .071, .65, -.65, .071, .65, .65, .071, -.65, .65, .071,
        .65, -.65, -.071, -.65, -.65, -.071, -.65, .65, -.071, .65, .65, -.071,
    ], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1], 2));
    geometry.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
    const texture = new THREE.Texture(bitmap); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace;
    const image = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({map: texture}));
    image.position.y = 1.4;
    return image;
}
export class NFTRepresentationRegistry {
    private renderers: NFTRepresentation[] = [];
    private characters=new CharacterModels();
    private nativeCollection?:string;private legacyCollection?:string;
    character(asset:NFTAsset){return !!this.nativeCollection&&[this.nativeCollection,this.legacyCollection].some(c=>c?.toLowerCase()===asset.contractAddress.toLowerCase())&&asset.tokenId>=1n&&asset.tokenId<=5000n;}
    async loadCharacter(asset:NFTAsset){return this.character(asset)?this.characters.load(asset.tokenId).catch(()=>null):null;}
    dispose(){this.characters.clear();}
    constructor(nativeCollection?: string,legacyCollection?:string) { this.nativeCollection=nativeCollection;this.legacyCollection=legacyCollection; if (nativeCollection)
        this.register({ supports: (a, metadata) => !metadata.image && a.contractAddress.toLowerCase() === nativeCollection.toLowerCase() && a.tokenId === 1n, createObject: () => { const g = new THREE.Group(); g.add(box(.8, 1.2, .5, 0x517d98, .8)); const head = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd8b48a })); head.position.y = 1.75; g.add(head); return g; } }); }
    register(renderer: NFTRepresentation) { this.renderers.unshift(renderer); }
    create(asset: NFTAsset, metadata: SafeMetadata) { const specific = this.renderers.find(r => r.supports(asset, metadata)); if (specific)
        return specific.createObject(asset, metadata); const group = new THREE.Group(); group.userData.artDisplay=true;const podium=box(1.5, .55, 1, 0x687684, .275);podium.userData.artPodium=true;group.add(podium); group.add(box(1.45, 1.5, .12, 0xb7a876, 1.4)); group.scale.setScalar(1.5); return group; }
    container() { return createChest(); }
    door() { return createLockedDoor(); }
}
interface Entry {
    group: THREE.Group;
    request: number;
    snapshot: NFTSnapshot;
}
export class NFTLayer {
    readonly parcels = new Map<number, Entry>();
    private scene: THREE.Scene;
    private provider: Pick<NFTStateProvider,'snapshot'>;
    private registry: NFTRepresentationRegistry;
    private seed: bigint;
    private cache: MetadataCache;
    private report: (message: string) => void;
    constructor(scene: THREE.Scene, provider: Pick<NFTStateProvider,'snapshot'>, registry: NFTRepresentationRegistry, seed: bigint, cache: MetadataCache, report: (message: string) => void) { this.scene = scene; this.provider = provider; this.registry = registry; this.seed = seed; this.cache = cache; this.report = report; }
    sync(ids: Iterable<number>) { const wanted = new Set(ids); for (const [id, e] of this.parcels)
        if (!wanted.has(id)) {
            disposeEntity(e.group);
            this.parcels.delete(id);
        } for (const id of wanted)
        if (!this.parcels.has(id)) {
            const group = new THREE.Group();
            this.scene.add(group);
            this.parcels.set(id, { group, request: 0, snapshot: { attachments: [], containers: [], doors: [] } });
            void this.refresh(id);
        } }
    async refresh(id: number) {
        const entry = this.parcels.get(id);
        if (!entry)
            return;
        const request = ++entry.request;
        let group: THREE.Group | undefined;
        try {
            const snapshot = await this.provider.snapshot(id);
            if (this.parcels.get(id) !== entry || request !== entry.request)
                return;
            group = new THREE.Group();
            const place = (mesh: THREE.Group, t: {
                y?: number;
                x: number;
                z: number;
                rotation: number;
            }) => { const p = objectToWorldPosition(id, t); mesh.position.set(p.x, t.y===undefined?getGroundHeight(p.x, p.z, this.seed):t.y/100, p.z); mesh.rotation.y = t.rotation / 100 * Math.PI / 180; group!.add(mesh); };
            for (const container of snapshot.containers) {
                const mesh = this.registry.container();
                mesh.userData = { kind: 'container', entity: container };
                place(mesh, container);
            }
            for (const door of snapshot.doors) {
                const mesh = this.registry.door();
                mesh.userData = { kind: 'door', entity: door };
                place(mesh, door);
            }
            // Contained NFTs have one canonical container representation; do not duplicate them on the parcel floor.
            for (const a of snapshot.attachments) {
                if (a.location.kind !== 'parcel')
                    continue;
                const metadata = await this.cache.get(a.asset);
                if (this.parcels.get(id) !== entry || request !== entry.request) {
                    disposeEntity(group);
                    return;
                }
                const character=await this.registry.loadCharacter(a.asset);
                if(this.parcels.get(id)!==entry||request!==entry.request){if(character)disposeEntity(character);disposeEntity(group);return;}
                const mesh = character ?? this.registry.create(a.asset, metadata);
                mesh.userData = { ...mesh.userData, kind: 'nft', entity: a, metadata };
                place(mesh, a.location);
                if (metadata.image && !mesh.userData.characterModel) {
                    const ownedGroup = group;
                    void loadSafeImage(metadata.image).then(bitmap => { if (this.parcels.get(id) !== entry || request !== entry.request) {
                        bitmap.close();
                        return;
                    } const image = createNFTArtwork(bitmap); if (mesh.parent === ownedGroup)
                        mesh.add(image);
                    else {
                        image.material.map!.dispose();
                        bitmap.close();
                        image.geometry.dispose();
                        (image.material as THREE.Material).dispose();
                    } }).catch(() => { });
                }
            }
            if (this.parcels.get(id) !== entry || request !== entry.request) {
                disposeEntity(group);
                return;
            }
            for (const child of [...entry.group.children])
                disposeEntity(child);
            entry.group.add(group);
            entry.snapshot = snapshot;
        }
        catch (error) {
            if (group)
                disposeEntity(group);
            this.report(`NFT state #${id}: ${String(error).slice(0, 180)}`);
        }
    }
    updateGrounding(height:(x:number,z:number)=>number,surfaces:THREE.Object3D[]=[]) {
        for(const entry of this.parcels.values())for(const batch of entry.group.children)for(const entity of batch.children)
            if(entity.userData.kind==='container'||entity.userData.kind==='nft'||entity.userData.kind==='edition'){const mount=entity.userData.artDisplay?wallMount(entity.position.x,entity.position.z,Math.round(entity.rotation.y*180/Math.PI*100),surfaces):undefined;entity.position.y=mount?.y??height(entity.position.x,entity.position.z);setArtMounted(entity,!!mount);}
    }
    roots() { return [...this.parcels.values()].map(e => e.group); }
    count() { return [...this.parcels.values()].reduce((n, e) => n + e.snapshot.attachments.length, 0); }
    focusedIdentity(object: THREE.Object3D) { return object.userData.kind === 'nft' ? assetKey(object.userData.entity.asset) : ''; }
    dispose() { for (const entry of this.parcels.values())
        disposeEntity(entry.group); this.parcels.clear();this.registry.dispose(); }
}
