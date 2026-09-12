import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAD_AXES,ROADS,WORLD_LIMIT,overlaps} from '../src/lib/hood-layout.ts';
import {BUILDINGS,buildNeighborhood} from '../src/lib/hood-buildings.ts';
import {intersects} from '../src/lib/hood-state.ts';
import * as T from 'three';
test('all buildings and their frontage clear every roadway',()=>{
 for(const b of BUILDINGS)for(const road of ROADS)assert.equal(overlaps(b,road,3),false,`${b.id} overlaps road ${road.x},${road.z}`);
 for(let i=0;i<BUILDINGS.length;i++)for(let j=i+1;j<BUILDINGS.length;j++)assert.equal(overlaps(BUILDINGS[i],BUILDINGS[j],1),false);
 assert.ok(WORLD_LIMIT>150);assert.equal(ROAD_AXES.length,5);
});
test('cars can complete every lane and intersection without hitting a building or furnishing',()=>{
 const scene=new T.Scene(),obstacles=[],solid=[],geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
 const box=(w,h,d,x,y,z,c,parent=scene)=>{const mesh=new T.Mesh(geometry,material);parent.add(mesh);return mesh;};
 const buildings=buildNeighborhood(scene,box,()=>new T.Mesh(geometry,material),obstacles,solid);
 for(const axis of ROAD_AXES)for(const lane of [-3,3])for(let a=-144;a<=144;a+=.5){
  assert.equal(intersects(axis+lane,a,1.25,obstacles),false,`north/south lane ${axis},${a}`);
  assert.equal(intersects(a,axis+lane,1.25,obstacles),false,`east/west lane ${a},${axis}`);
 }
 buildings.dispose();geometry.dispose();material.dispose();
});
