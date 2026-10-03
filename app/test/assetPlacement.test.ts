import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {PersistentObjectLayer} from '../src/objects/persistentLayer.ts';
import {ObjectRegistry} from '../src/objects/registry.ts';
import {getGroundHeight} from '../src/world/terrain.ts';
import {objectToWorldPosition, type PersistentWorldObject} from '../src/objects/model.ts';
test('asset support uses foundation height, not roofs, and returns to terrain after removal',async()=>{
 let objects:PersistentWorldObject[]=[{id:1,objectType:7,x:3200,z:3200,y:10000,rotation:9000},{id:2,objectType:11,x:3200,z:3200,y:15000,rotation:0}];
 const registry=new ObjectRegistry();const layer=new PersistentObjectLayer(new Scene(),{getObjects:async()=>objects},registry,7422026n,()=>{});
 layer.sync([742]);await layer.refresh(742);
 const p=objectToWorldPosition(742,{x:3200,z:3200});
 assert.equal(layer.assetHeight(p.x,p.z),100.5);
 assert.equal(layer.assetHeight(p.x+3,p.z),getGroundHeight(p.x+3,p.z,7422026n));
 objects=[];await layer.refresh(742);assert.equal(layer.assetHeight(p.x,p.z),getGroundHeight(p.x,p.z,7422026n));
 layer.dispose();registry.dispose();
});
