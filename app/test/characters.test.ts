import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {characterAsset,characterModelURL,CharacterModels,validateCharacterGLB} from '../src/nfts/characters.ts';
import {disposeEntity,NFTRepresentationRegistry} from '../src/nfts/rendering.ts';
const collection='0x3333333333333333333333333333333333333333';
test('native character identity restricts IDs and model URLs to the authored collection range',()=>{
 assert.equal(characterAsset(8453,collection,'5000').tokenId,5000n);
 assert.equal(characterModelURL(1n),'https://atlas-mu-lime.vercel.app/cryptodoodz/models/0001.glb');
 for(const id of ['0','5001','-1','1.5','javascript:1'])assert.throws(()=>characterAsset(8453,collection,id));
 assert.throws(()=>validateCharacterGLB(new ArrayBuffer(25)));
 const registry=new NFTRepresentationRegistry(collection);assert.ok(registry.character(characterAsset(8453,collection,'12')));assert.equal(registry.character({...characterAsset(8453,collection,'12'),contractAddress:'0x1111111111111111111111111111111111111111'}),false);registry.dispose();
});
test('native model loads once, grounds independent copies and disposes their GPU resources',async()=>{
 const bytes=await readFile('app/public/cryptodoodz/models/0001.glb'),fetchOriginal=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(bytes,{status:200});};
 const models=new CharacterModels();try{const first=await models.load(1n),second=await models.load(1n);assert.equal(calls,1);assert.notEqual(first,second);
 let skinned=0;first.traverse(o=>{if(o instanceof THREE.SkinnedMesh){skinned++;assert.equal(o.frustumCulled,false);}});assert.ok(skinned>0);
 const bounds=new THREE.Box3().setFromObject(first),size=bounds.getSize(new THREE.Vector3());assert.ok(Math.abs(bounds.min.y)<.0001);assert.ok(size.y<=2.201);assert.ok(size.x<=2.601&&size.z<=2.601);
 // Aiming at a placed character far from world origin must hit its stable target.
 first.position.set(96,5,42);first.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(96,6.5,46),new THREE.Vector3(0,0,-1),0,5);
 assert.ok(ray.intersectObject(first,true).some(hit=>hit.object.userData.characterInteractionTarget));
 let disposed=0;first.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.addEventListener('dispose',()=>disposed++);});disposeEntity(first);assert.ok(disposed>0);assert.ok(second.children.length>0);disposeEntity(second);
 }finally{models.clear();globalThis.fetch=fetchOriginal;}
});

test('only the current character collection receives native character support',()=>{
 const original='0x1111111111111111111111111111111111111111';
 const registry=new NFTRepresentationRegistry(collection);
 assert.equal(registry.character(characterAsset(8453,collection,'1')),true);
 assert.equal(registry.character(characterAsset(8453,original,'1')),false);
 assert.equal(registry.character(characterAsset(8453,'0x2222222222222222222222222222222222222222','1')),false);
 registry.dispose();
});
