import { objectBaseY, localPoint, structureBlocks, stairTop, storeyStairTop } from './building.ts';
import { Group, PointLight, type Vector3, type Scene } from 'three';
import type { ParcelStateProvider } from '../blockchain/parcelState.ts';
import { objectToWorldPosition, type PersistentWorldObject } from './model.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { ObjectRegistry } from './registry.ts';

interface LoadedObjects { group: Group; request: number; ready: boolean; objects: PersistentWorldObject[] }
export class PersistentObjectLayer {
  private lights = Array.from({length:4},()=>new PointLight(0xffb65b,0,7,2));
  readonly parcels = new Map<number, LoadedObjects>();
  private scene: Scene;
  private provider: ParcelStateProvider;
  private registry: ObjectRegistry;
  private seed: bigint;
  private report: (tokenId: number, error?: unknown) => void;
  constructor(scene: Scene, provider: ParcelStateProvider, registry: ObjectRegistry, seed: bigint, report: (tokenId: number, error?: unknown) => void) {
    this.lights.forEach(light=>scene.add(light));
    this.scene = scene; this.provider = provider; this.registry = registry; this.seed = seed; this.report = report;
  }
  sync(tokenIds: Iterable<number>) {
    const desired = new Set(tokenIds);
    for (const [id, entry] of this.parcels) if (!desired.has(id)) { entry.group.removeFromParent(); entry.group.clear(); this.parcels.delete(id); }
    for (const id of desired) if (!this.parcels.has(id)) {
      const group = new Group(); this.scene.add(group); this.parcels.set(id, { group, request: 0, ready: false, objects: [] });
      void this.refresh(id);
    }
  }
  async refresh(id: number) {
    const entry = this.parcels.get(id); if (!entry) return;
    const request = ++entry.request; entry.ready = false;
    try {
      const objects = await this.provider.getObjects(BigInt(id));
      // Prevent an old response from resurrecting an unloaded/reloaded parcel or overwriting a newer read.
      if (this.parcels.get(id) !== entry || entry.request !== request) return;
      const replacement = new Group();
      for (const object of objects) {
        const mesh = this.registry.create(object.objectType), world = objectToWorldPosition(id, object);
        mesh.position.set(world.x, objectBaseY(id, object, this.seed), world.z);
        mesh.rotation.y = object.rotation / 100 * Math.PI / 180;
        mesh.userData = { kind: 'persistent', tokenId: id, objectId: object.id, objectType:object.objectType };
        replacement.add(mesh);
      }
      entry.group.clear(); entry.group.add(replacement); entry.objects = objects; entry.ready = true; this.report(id);
    } catch (error) { if (this.parcels.get(id) === entry && entry.request === request) this.report(id, error); }
  }
  roots() { return [...this.parcels.values()].map(entry => entry.group); }
  find(tokenId: number, objectId: number) {
    return this.parcels.get(tokenId)?.group.children[0]?.children.find(object => object.userData.objectId === objectId);
  }
  updateLighting(camera:Vector3) {
    const positions=this.roots().flatMap(root=>root.children.flatMap(group=>group.children)).filter(o=>o.userData.objectType===12).sort((a,b)=>a.position.distanceToSquared(camera)-b.position.distanceToSquared(camera));
    this.lights.forEach((light,i)=>{const o=positions[i];light.intensity=o?12:0;if(o)light.position.copy(o.position).y+=2;});
  }
  /** Current NFT custody stores X/Z only: use the highest foundation at that point. */
  assetHeight(x:number,z:number) {
    let height=getGroundHeight(x,z,this.seed);
    for(const [id,entry] of this.parcels)for(const o of entry.objects)if(o.objectType===7){
      const p=objectToWorldPosition(id,o),q=localPoint(x,z,p.x,p.z,o.rotation);
      if(Math.abs(q.x)<=2&&Math.abs(q.z)<=2)height=Math.max(height,objectBaseY(id,o,this.seed)+.5);
    }
    return height;
  }
  floorHeight(x:number,z:number,feet=Infinity) {
    let height=getGroundHeight(x,z,this.seed);
    for(const [id,entry] of this.parcels)for(const o of entry.objects)if([7,11,14,15].includes(o.objectType)){
      const p=objectToWorldPosition(id,o),local=localPoint(x,z,p.x,p.z,o.rotation),base=objectBaseY(id,o,this.seed);
      const top=o.objectType===15?storeyStairTop(local.x,local.z,base):o.objectType===14?stairTop(local.x,local.z,base):Math.abs(local.x)<=2&&Math.abs(local.z)<=2?base+(o.objectType===11?3.9:.5):null;
      if(top!==null && top<=feet+.65)height=Math.max(height,top);
    }
    return height;
  }
  ceilingHeight(x:number,z:number,feet:number) {
    let ceiling=Infinity;
    for(const [id,entry] of this.parcels)for(const o of entry.objects){
      const p=objectToWorldPosition(id,o),q=localPoint(x,z,p.x,p.z,o.rotation),base=objectBaseY(id,o,this.seed);
      const bottom=o.objectType===11?base+3.7:o.objectType===7?base-.5:o.objectType===9?base+3.4:Infinity;
      const inside=o.objectType===9?Math.abs(q.x)<2.28&&Math.abs(q.z)<.43:Math.abs(q.x)<2.28&&Math.abs(q.z)<2.28;
      if(inside&&bottom>=feet+1.65)ceiling=Math.min(ceiling,bottom);
    }return ceiling;
  }
  blocks(x:number,z:number,feet:number) {
    for(const [id,entry] of this.parcels)for(const o of entry.objects){
      const p=objectToWorldPosition(id,o),local=localPoint(x,z,p.x,p.z,o.rotation),base=objectBaseY(id,o,this.seed);
      const tread=o.objectType===15?storeyStairTop(local.x,local.z,base):o.objectType===14?stairTop(local.x,local.z,base):null;
      if(tread!==null&&tread>feet+.65&&feet+1.65>base)return true;
      if(structureBlocks(o.objectType,local.x,local.z,feet,base))return true;
      if(o.objectType===7 && Math.abs(local.x)<2.28 && Math.abs(local.z)<2.28 && base+.5>feet+.65 && feet+1.65>base-.5)return true;
    }return false;
  }
  dispose() { this.lights.forEach(light=>{light.removeFromParent();light.dispose();}); for (const entry of this.parcels.values()) { entry.group.removeFromParent(); entry.group.clear(); } this.parcels.clear(); }
}
