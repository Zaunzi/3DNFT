import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MockTrinketProvider, EXPERIENCE_KEY} from '../src/trinkets/mock.ts';
import {MockInventoryProvider} from '../src/items/mockInventory.ts';
import {ExperienceLayer,ExperienceRegistry} from '../src/items/rendering.ts';
import {validateItemPlacement} from '../src/trinkets/model.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFile} from 'node:fs/promises';
const alice='0x1111111111111111111111111111111111111111',bob='0x2222222222222222222222222222222222222222';
test('trinket custody persists separately, inherits land, rejects duplicates and invalid placement',async()=>{
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};let account:typeof alice|typeof bob=alice,owner:string=alice;
 const make=()=>new MockTrinketProvider(storage,()=>account,()=>account===owner);let trinkets=make();const utilities=new MockInventoryProvider(storage,()=>account,()=>true);
 await trinkets.grantDevItem(1,2n);await utilities.grantDevItem(1,8n);
 const placement={itemType:1,quantity:1n,x:3200,z:3200,rotation:0};
 await assert.rejects(trinkets.placeItem(742,{...placement,x:199}));await assert.rejects(trinkets.placeItem(742,{...placement,quantity:2n}));
 await trinkets.placeItem(742,placement);assert.equal(await trinkets.getBalance(alice,1n),1n);assert.equal(await utilities.getBalance(alice,1n),8n);
 trinkets=make();assert.equal((await trinkets.getItems(742)).length,1);assert.ok(data.has(EXPERIENCE_KEY));
 owner=bob;await assert.rejects(trinkets.pickupItem(742,1));account=bob;await trinkets.pickupItem(742,1);
 assert.equal(await trinkets.getBalance(bob,1n),1n);assert.equal(await trinkets.getBalance(alice,1n),1n);assert.equal((await trinkets.getItems(742)).length,0);await assert.rejects(trinkets.pickupItem(742,1));
});
test('neighbor trinket attachments stream in and unload without retaining scene roots',async()=>{
 const data=new Map<string,string>(),store=new MockTrinketProvider({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}},()=>alice,()=>true);
 await store.grantDevItem(5,1n);await store.placeItem(743,{itemType:5,quantity:1n,x:3200,z:3200,rotation:9000});
 class TestRegistry extends ExperienceRegistry {override validateItem(item:any){validateItemPlacement(item);}override item(){return new THREE.Group();}}
 const scene=new THREE.Scene(),registry=new TestRegistry(),layer=new ExperienceLayer(scene,store,registry,7422026n,()=>assert.fail('loading failed'),'trinket');
 layer.sync([742,743]);await layer.refresh(743);assert.equal(layer.count('items'),1);assert.equal(layer.roots().flatMap(g=>g.children.flatMap(c=>c.children)).filter(g=>g.userData.kind==='trinket').length,1);
 layer.sync([742]);assert.equal(layer.count('items'),0);layer.dispose();registry.dispose();assert.equal(scene.children.length,0);
});
test('all five exported legacy models fit the onchain footprint and sit at ground level',async()=>{
 for(let id=1;id<=5;id++){const bytes=await readFile(`app/src/trinkets/models/${id}.glb`);const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3());assert.ok(Math.abs(box.min.y)<1e-5);assert.ok(Math.hypot(size.x,size.z)<=3.201);let meshes=0;gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});assert.ok(meshes>10);}
});
