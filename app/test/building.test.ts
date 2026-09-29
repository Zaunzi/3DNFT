import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MockParcelStateProvider} from '../src/blockchain/mockParcelState.ts';
import {ObjectRegistry} from '../src/objects/registry.ts';
import {PersistentObjectLayer} from '../src/objects/persistentLayer.ts';
import {objectToWorldPosition,validatePlacement,type WorldObjectType} from '../src/objects/model.ts';
import {localPoint,snapBuildCoordinate,structureBlocks,snapStructure} from '../src/objects/building.ts';
import {MockInventoryProvider} from '../src/items/mockInventory.ts';
import {MockNFTProvider,MOCK_ITEMS} from '../src/nfts/mock.ts';
const alice='0x1111111111111111111111111111111111111111' as const;
function storage(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};}
test('modular pieces retain shared elevation across reload and ownership changes',async()=>{
 const store=storage();let owner=true;const provider=new MockParcelStateProvider(store,()=>owner);
 for(const type of [7,8,9,10,11,12] as WorldObjectType[])await provider.addObject(742n,{objectType:type,x:3200,z:3200,rotation:9000,y:1200});
 const restored=new MockParcelStateProvider(store,()=>true);assert.equal((await restored.getObjects(742n)).length,6);
 assert.ok((await restored.getObjects(742n)).every(o=>o.y===1200));owner=false;
 await assert.rejects(provider.removeObject(742n,1),/owner/);await restored.removeObject(742n,1);
 assert.equal((await restored.getObjects(742n)).length,5);
 for(const bad of [{y:undefined},{y:32001},{rotation:1500},{x:0}])assert.throws(()=>validatePlacement({objectType:7,x:3200,z:3200,rotation:0,y:1200,...bad}));
});
test('grid, rotated walls and doorway opening match the modular footprint',()=>{
 assert.equal(snapBuildCoordinate(1224),1200);assert.equal(snapBuildCoordinate(1276),1300);
 const point=localPoint(10,11,10,10,9000);assert.ok(Math.abs(point.x+1)<1e-8);assert.ok(Math.abs(point.z)<1e-8);
 assert.equal(structureBlocks(8,0,0,12.5,12),true);
 assert.equal(structureBlocks(9,0,0,12.5,12),false);
 assert.equal(structureBlocks(9,1.5,0,12.5,12),true);
 assert.equal(structureBlocks(10,0,0,12.5,12),true);
 assert.equal(structureBlocks(8,0,1,12.5,12),false);
});
test('streamed foundation provides a level walkable floor; lantern lights unload',async()=>{
 const provider=new MockParcelStateProvider(storage(),()=>true),registry=new ObjectRegistry(),scene=new Scene();
 await provider.addObject(742n,{objectType:7,x:3200,z:3200,rotation:0,y:12000});
 await provider.addObject(742n,{objectType:12,x:3300,z:3300,rotation:0,y:12050});
 const layer=new PersistentObjectLayer(scene,provider,registry,7422026n,()=>{});layer.sync([742]);await layer.refresh(742);
 const p=objectToWorldPosition(742,{x:3200,z:3200});assert.equal(layer.floorHeight(p.x,p.z,120),120.5);
 assert.equal(layer.find(742,1)?.position.y,120);layer.updateLighting(new Vector3(p.x,122,p.z));
 assert.ok(scene.children.some(o=>o.type==='PointLight' && (o as any).intensity>0));
 layer.sync([]);layer.updateLighting(new Vector3());assert.ok(scene.children.filter(o=>o.type==='PointLight').every(o=>(o as any).intensity===0));
 layer.dispose();registry.dispose();assert.equal(scene.children.length,0);
});
test('elevated locked door persists; key is checked without consumption',async()=>{
 const store=storage(),ledger=new MockInventoryProvider(store,()=>alice,()=>true),nfts=new MockNFTProvider(ledger,31337,alice,()=>true);
 await nfts.createDoor(742,{x:3200,z:3000,rotation:0,y:1250},{kind:'erc1155',contractAddress:MOCK_ITEMS,tokenId:4n,minimum:1n,mode:'CHECK_ONLY'});
 const door=(await new MockNFTProvider(ledger,31337,alice,()=>true).snapshot(742)).doors[0];assert.equal(door.y,1250);
 assert.equal(await nfts.canOpen(door,alice),false);await ledger.grantDevItem(4,1n);
 assert.equal(await nfts.canOpen(door,alice),true);assert.equal(await ledger.getBalance(alice,4n),1n);
});

test('walls snap to foundation edges with inherited elevation; roofs align to supporting walls',()=>{
 const foundation={id:1,objectType:7 as const,x:3200,z:3200,y:150,rotation:0};
 const wall=snapStructure(8,3200,3005,[foundation])!;
 assert.equal(wall.x,3200);assert.equal(wall.z,3000);assert.equal(wall.y,150);assert.equal(wall.rotation,0);
 const side=snapStructure(9,3402,3200,[foundation])!;assert.equal(side.x,3400);assert.equal(side.rotation,9000);
 assert.equal(snapStructure(11,3200,3200,[foundation]),null);
 const roof=snapStructure(11,3250,3150,[foundation,{id:2,objectType:8,...wall}])!;
 assert.equal(roof.x,3200);assert.equal(roof.z,3200);assert.equal(roof.y,150);
 assert.equal(snapStructure(8,5000,5000,[foundation]),null);
});

test('foundations snap flush in all directions, inherit height and avoid occupied slots',()=>{
 const base={id:1,objectType:7 as const,x:3200,z:3200,y:175,rotation:9000};
 for(const [x,z] of [[2800,3200],[3600,3200],[3200,2800],[3200,3600]]){
   const snapped=snapStructure(7,x+10,z-10,[base])!;
   assert.equal(snapped.x,x);assert.equal(snapped.z,z);assert.equal(snapped.y,175);assert.equal(snapped.rotation,9000);
   assert.equal(Math.hypot(snapped.x-base.x,snapped.z-base.z),400);
 }
 const neighbor={...base,id:2,x:3600};
 assert.equal(snapStructure(7,3600,3200,[base,neighbor]),null);
 const extension=snapStructure(7,4000,3200,[base,neighbor])!;assert.equal(extension.x,4000);assert.equal(extension.y,175);
 assert.equal(snapStructure(7,5500,5500,[base]),null);
});
