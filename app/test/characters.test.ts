import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {characterAsset,characterModelURL,CharacterModels,validateCharacterGLB} from '../src/nfts/characters.ts';
import {disposeEntity,NFTRepresentationRegistry} from '../src/nfts/rendering.ts';
const collection='0x3333333333333333333333333333333333333333';
test('native character identity restricts IDs and model URLs to the authored collection range',()=>{
 assert.equal(characterAsset(8453,collection,'1000').tokenId,1000n);
 assert.equal(characterModelURL(1n),'https://3dnft.vercel.app/cryptodoodz/models/0001.glb');
 for(const id of ['0','1001','-1','1.5','javascript:1'])assert.throws(()=>characterAsset(8453,collection,id));
 assert.throws(()=>validateCharacterGLB(new ArrayBuffer(25)));
 const registry=new NFTRepresentationRegistry(collection);assert.ok(registry.character(characterAsset(8453,collection,'12')));assert.equal(registry.character({...characterAsset(8453,collection,'12'),contractAddress:'0x1111111111111111111111111111111111111111'}),false);registry.dispose();
});
test('native model loads once, grounds independent copies and disposes their GPU resources',async()=>{
 const bytes=await readFile('static/cryptodoodz/models/0001.glb'),fetchOriginal=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(bytes,{status:200});};
 const models=new CharacterModels();try{const first=await models.load(1n),second=await models.load(1n);assert.equal(calls,1);assert.notEqual(first,second);
 const bounds=new THREE.Box3().setFromObject(first),size=bounds.getSize(new THREE.Vector3());assert.ok(Math.abs(bounds.min.y)<.0001);assert.ok(size.y<=2.201);assert.ok(size.x<=2.601&&size.z<=2.601);
 let disposed=0;first.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.addEventListener('dispose',()=>disposed++);});disposeEntity(first);assert.ok(disposed>0);assert.ok(second.children.length>0);disposeEntity(second);
 }finally{models.clear();globalThis.fetch=fetchOriginal;}
});
