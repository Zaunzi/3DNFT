import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MockParcelStateProvider} from '../src/blockchain/mockParcelState.ts';
import {ObjectRegistry} from '../src/objects/registry.ts';
import {PersistentObjectLayer} from '../src/objects/persistentLayer.ts';
import {objectToWorldPosition,validatePlacement,type WorldObjectType} from '../src/objects/model.ts';
import {localPoint,snapBuildCoordinate,structureBlocks,snapStructure,stairTop,storeyStairTop,placementBaseHeight} from '../src/objects/building.ts';
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

test('entrance stairs snap high end flush to all four foundation edges and have walkable treads',()=>{
 const base={id:1,objectType:7 as const,x:3200,z:3200,y:150,rotation:0};
 for(const [x,z,r] of [[3200,3500,0],[3200,2900,18000],[3500,3200,9000],[2900,3200,27000]]){
  const s=snapStructure(14,x,z,[base])!;assert.equal(s.x,x);assert.equal(s.z,z);assert.equal(s.rotation,r);assert.equal(s.y,100);
  assert.equal(stairTop(0,-.99,s.y/100),base.y/100+.5);
 }
 assert.deepEqual([.99,.49,-.01,-.51].map(z=>stairTop(0,z,1)),[1.25,1.5,1.75,2]);
 assert.equal(stairTop(1.01,0,1),null);
 validatePlacement({objectType:14,x:3200,z:3200,y:100,rotation:9000});
});

test('wall stacking and lateral extensions preserve orientation and storey heights',()=>{
 const wall={id:9,objectType:8 as const,x:3200,z:3000,y:150,rotation:9000};
 const upper=snapStructure(10,3200,3000,[wall],{id:9,hitY:490})!;
 assert.equal(upper.y,490);assert.equal(upper.x,3200);assert.equal(upper.z,3000);assert.equal(upper.rotation,9000);
 const side=snapStructure(8,3200,2900,[wall],{id:9,hitY:250})!;
 assert.equal(side.y,150);assert.equal(Math.hypot(side.x-wall.x,side.z-wall.z),400);
 const roof=snapStructure(11,3100,3000,[{...wall,y:490}],{id:9,hitY:700})!;
 assert.equal(roof.y,490);assert.equal(Math.hypot(roof.x-wall.x,roof.z-wall.z),200);
});
test('full-height stairs meet upper floor and roofs provide elevated walking surfaces',async()=>{
 const roof={id:1,objectType:11 as const,x:3200,z:3200,y:12000,rotation:0};
 const stairs=snapStructure(15,3200,3600,[roof])!;assert.equal(stairs.y,12050);
 assert.equal(storeyStairTop(0,-1.999,stairs.y/100),123.9);
 const registry=new ObjectRegistry(),provider=new MockParcelStateProvider(storage(),()=>true);
 await provider.addObject(742n,roof);await provider.addObject(742n,{objectType:15,...stairs});
 const layer=new PersistentObjectLayer(new Scene(),provider,registry,7422026n,()=>{});layer.sync([742]);await layer.refresh(742);
 const p=objectToWorldPosition(742,roof);assert.equal(layer.floorHeight(p.x,p.z,123.9),123.9);
 assert.ok(layer.floorHeight(p.x,p.z,120)<123);assert.equal(layer.ceilingHeight(p.x,p.z,120.5),123.7);
 layer.dispose();registry.dispose();
});

test('roof tiles snap flush, preserve the selected storey, and skip occupied roof slots',()=>{
 const roof={id:1,objectType:11 as const,x:3200,z:3200,y:150,rotation:9000};
 for(const [x,z] of [[2800,3200],[3600,3200],[3200,2800],[3200,3600]]){
  const s=snapStructure(11,x+10,z-10,[roof])!;
  assert.equal(s.x,x);assert.equal(s.z,z);assert.equal(s.y,150);assert.equal(s.rotation,9000);
 }
 const upper={...roof,id:2,y:490};
 assert.equal(snapStructure(11,3600,3200,[roof,upper],{id:2,hitY:880})!.y,490);
 const neighbor={...roof,id:3,x:3600};
 assert.equal(snapStructure(11,3600,3200,[roof,neighbor],{id:1,hitY:540}),null);
 assert.equal(snapStructure(11,4000,3200,[roof,neighbor])!.x,4000);
});

test('locked doors snap to doorway transforms, including upper-storey openings',()=>{
 const lower={id:1,objectType:9 as const,x:3200,z:3000,y:150,rotation:9000};
 const upper={...lower,id:2,y:490};
 const snap=snapStructure(13,3250,3050,[lower,upper],{id:2,hitY:700})!;
 assert.equal(snap.x,upper.x);assert.equal(snap.z,upper.z);assert.equal(snap.y+50,540);assert.equal(snap.rotation,9000);
 assert.equal(snapStructure(13,5000,5000,[lower]),null);
});

test('independent placements follow local ground without inheriting the previous foundation height',()=>{
 assert.equal(placementBaseHeight(5,''),5);
 assert.equal(placementBaseHeight(-2,''),-2);
 assert.equal(placementBaseHeight(-2,'',500),5);
 assert.equal(placementBaseHeight(-2,'3.25'),3.25);
 assert.equal(placementBaseHeight(-2,'',undefined,.5),.5);
});

test('wider storey staircase supports its full three-meter tread width',()=>{assert.notEqual(storeyStairTop(1.49,0,0),null);assert.notEqual(storeyStairTop(-1.49,0,0),null);assert.equal(storeyStairTop(1.51,0,0),null);});
