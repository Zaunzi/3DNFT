import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {InteractionController} from '../src/interactions/controller.ts';
import {instrumentPage} from '../src/trinkets/playback.ts';
test('instrument playback is restricted to the five authored instruments',()=>{
 assert.deepEqual([1,2,3,4,5].map(instrumentPage),['dj-board','keyboard','drumkit','xylophone','bongos']);
 for(const id of [0,6,-1,1.5,NaN])assert.throws(()=>instrumentPage(id));
});
test('left click plays nearby instruments for visitors, but drag, right click, distance, walls and disabled mode do not',()=>{
 const events=new EventTarget();Object.defineProperty(globalThis,'window',{value:events,configurable:true});
 const canvas=new EventTarget(),camera=new THREE.PerspectiveCamera(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.position.z=-2;mesh.updateMatrixWorld();
 const wall=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());wall.position.z=-1;wall.updateMatrixWorld();
 let played=0,enabled=true,blocked=false;const label={textContent:''};
 const controller=new InteractionController({canvas:canvas as HTMLCanvasElement,camera,roots:()=>[mesh],occluders:()=>blocked?[wall]:[],enabled:()=>enabled,context:()=>({connected:false,canEdit:()=>false}),label:label as HTMLElement,report:()=>{},resolve:()=>({id:'instrument',type:'item',play:()=>{played++;},playLabel:'Play Afterhours',getInteractionLabel:()=> 'Pick up',canInteract:()=>false,interact:async()=>assert.fail('pickup must not run')})});
 const event=(type:string,fields:object={})=>canvas.dispatchEvent(Object.assign(new Event(type),{button:0,movementX:0,movementY:0,...fields}));
 const click=()=>{event('pointerdown');event('pointerup');};
 try{controller.update();assert.match(label.textContent,/Left click/);click();assert.equal(played,1);
 event('pointerdown');event('pointermove',{movementX:20});event('pointerup');assert.equal(played,1);
 event('pointerdown',{button:2});event('pointerup',{button:2});assert.equal(played,1);
 blocked=true;click();assert.equal(played,1);blocked=false;enabled=false;click();assert.equal(played,1);enabled=true;
 mesh.position.z=-10;mesh.updateMatrixWorld();click();assert.equal(played,1);
 }finally{controller.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();wall.geometry.dispose();(wall.material as THREE.Material).dispose();Reflect.deleteProperty(globalThis,'window');}
});

test('third-person reach is measured from the player, not the trailing camera',()=>{
 const events=new EventTarget();Object.defineProperty(globalThis,'window',{value:events,configurable:true});
 const camera=new THREE.PerspectiveCamera();camera.position.z=4.5;
 const player=new THREE.Vector3(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.position.z=-3;mesh.updateMatrixWorld();
 const label={textContent:''};const controller=new InteractionController({camera,origin:()=>player,roots:()=>[mesh],occluders:()=>[],enabled:()=>true,context:()=>({connected:true,canEdit:()=>true}),label:label as HTMLElement,report:()=>{},resolve:()=>({id:'test',type:'NFT',getInteractionLabel:()=> 'Inspect',canInteract:()=>true,interact:async()=>{}})});
 try{controller.update();assert.match(label.textContent,/Inspect/);camera.position.z=7;controller.update();assert.match(label.textContent,/Inspect/);player.z=5;controller.update();assert.equal(label.textContent,'');}finally{controller.dispose();mesh.geometry.dispose();mesh.material.dispose();Reflect.deleteProperty(globalThis,'window');}
});
