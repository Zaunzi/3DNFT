import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Scene} from 'three';
import {wallMount,setArtMounted,hitWall} from '../src/nfts/artMount.ts';
import {NFTLayer,NFTRepresentationRegistry,disposeEntity} from '../src/nfts/rendering.ts';
test('art snaps to both wall faces and survives centimeter encoding on rotated walls',()=>{for(const angle of [0,Math.PI/2,Math.PI])for(const side of [-1,1]){const wall=new Group();wall.userData={kind:'persistent',objectType:8};wall.position.set(96,4,32);wall.rotation.y=angle;wall.updateMatrixWorld();const mount=wallMount(96+side*.2*Math.sin(angle),32+side*.2*Math.cos(angle),0,[wall],true)!;assert.ok(mount);const restored=wallMount(Math.round(mount.x*100)/100,Math.round(mount.z*100)/100,mount.rotation,[wall]);assert.ok(restored);assert.equal(restored.y,4.15);assert.equal(wallMount(mount.x,mount.z,mount.rotation,[]),undefined);}});
test('wall mounting hides only podium and restores it when detached',()=>{const registry=new NFTRepresentationRegistry();const art=registry.create({chainId:8453,contractAddress:'0x1111111111111111111111111111111111111111',tokenId:1n},{name:'Art',description:'',attributes:[]});setArtMounted(art,true);assert.equal(art.children.find(c=>c.userData.artPodium)!.visible,false);assert.equal(art.children[1].visible,true);setArtMounted(art,false);assert.equal(art.children[0].visible,true);disposeEntity(art);registry.dispose();});

function stacked(){const roots=[1,4,7].map((y,i)=>{const w=new Group();w.userData={kind:'persistent',objectType:8,tokenId:1,objectId:i+1};w.position.set(96,y,32);w.updateMatrixWorld();return w;});return roots;}
test('raycast wall child resolves exact lower, middle or upper storey',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const side of [-1,1])for(const offset of [-1.8,0,1.8]){
  const roots=stacked();for(const w of roots){w.rotation.y=angle;const trim=new Group();w.add(trim);w.updateMatrixWorld();const target=hitWall(trim,1)!;assert.ok(target);assert.equal(hitWall(trim,2),undefined);
   const preview=wallMount(96+offset*Math.cos(angle)+side*.2*Math.sin(angle),32-offset*Math.sin(angle)+side*.2*Math.cos(angle),0,roots,true,target)!;
   const saved=wallMount(Math.round(preview.x*100)/100,Math.round(preview.z*100)/100,preview.rotation,roots,false,target)!;
   assert.equal(saved.y,w.position.y);
   assert.ok(Math.abs(saved.x-(96+side*.28*Math.sin(angle)))<.0001);
   assert.ok(Math.abs(saved.z-(32+side*.28*Math.cos(angle)))<.0001);
  }
 }
});
test('saved wall identity never jumps to another floor after wall deletion or ground placement',()=>{
 const roots=stacked();assert.equal(wallMount(96,32.28,0,roots,false,{parcelId:1,wallId:1})?.y,1);
 assert.equal(wallMount(96,32.28,0,roots.slice(1),false,{parcelId:1,wallId:1}),undefined);
 assert.equal(wallMount(96,32.28,0,roots,false,{parcelId:1,wallId:0}),undefined);
 assert.equal(wallMount(96,32.28,0,roots,false,{parcelId:2,wallId:1}),undefined);
 // Existing attachments without a reference retain their previous appearance.
 assert.equal(wallMount(96,32.28,0,roots)?.y,7.15);
});
test('shared NFT and edition rendering honours persisted wall references and restores podium if support is removed',()=>{
 for(const kind of ['nft','edition']){
  const roots=stacked(),scene=new Scene(),registry=new NFTRepresentationRegistry();
  const layer=new NFTLayer(scene,{snapshot:async()=>({attachments:[],containers:[],doors:[]})},registry,1n,{} as any,()=>{});
  const group=new Group(),batch=new Group();group.add(batch);
  const art=registry.create({chainId:8453,contractAddress:'0x1111111111111111111111111111111111111111',tokenId:1n},{name:'Art',description:'',attributes:[]});
  art.userData={...art.userData,kind,entity:{location:{kind:'parcel',parcelId:1,mountWallId:1}}};art.position.set(96,0,32.28);batch.add(art);
  (layer as any).parcels.set(1,{group,snapshot:{attachments:[]}});
  layer.updateGrounding(()=>0,roots);assert.equal(art.position.y,1);assert.equal(art.children.find(c=>c.userData.artPodium)!.visible,false);
  layer.updateGrounding(()=>0,roots.slice(1));assert.equal(art.position.y,0);assert.equal(art.children.find(c=>c.userData.artPodium)!.visible,true);
  layer.dispose();
 }
});
