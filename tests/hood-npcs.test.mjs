import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RESIDENTS} from '../src/lib/hood-npcs.ts';
import {intersects} from '../src/lib/hood-state.ts';

test('eight distinct collection residents have playable idle and walk animations',async()=>{
 assert.equal(new Set(RESIDENTS.map(n=>n.id)).size,8);
 for(const n of RESIDENTS){
  const raw=fs.readFileSync(`static/cryptodoodz/models/${String(n.id).padStart(4,'0')}.glb`);
  const model=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  for(const name of ['Idle','Walk'])assert.ok(model.animations.find(c=>c.name===name&&c.duration>0),`${n.id}: ${name}`);
 }
});
test('resident routes stay clear of buildings and range wall',()=>{
 const obstacles=[...[-23,23].flatMap(x=>[-22,23].map(z=>({x,z,w:18,d:14}))),{x:46,z:0,w:15,d:16},{x:-46,z:32,w:20,d:.5},...[[-45,-46],[-20,-49],[23,-48],[48,-40],[-49,2],[49,46],[-48,48]].map(([x,z])=>({x,z,w:14,d:13}))];
 for(const n of RESIDENTS)for(let i=0;i<=100;i++){
  const t=i/100,x=n.path[0][0]*(1-t)+n.path[1][0]*t,z=n.path[0][1]*(1-t)+n.path[1][1]*t;
  assert.equal(intersects(x,z,.4,obstacles),false,`${n.id} route at ${t}`);
 }
});
