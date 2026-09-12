import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BUILDINGS,entrance,wallPlan,buildNeighborhood} from '../src/lib/hood-buildings.ts';
import {intersects} from '../src/lib/hood-state.ts';

function fixture(){
 const scene=new T.Scene(),obstacles=[],solid=[],geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
 function box(w,h,d,x,y,z,c,parent=scene){const m=new T.Mesh(geometry,material);m.scale.set(w,h,d);m.position.set(x,y,z);parent.add(m);return m;}
 function sign(text,x,y,z,w,parent=scene){return box(w,.2,.01,x,y,z,0,parent);}
 const buildings=buildNeighborhood(scene,box,sign,obstacles,solid);
 return {scene,obstacles,buildings};
}
function reachable(start,end,b,obstacles){
 const step=.4,queue=[[start.x,start.z]],seen=new Set();
 for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i],key=`${Math.round((x-start.x)/step)},${Math.round((z-start.z)/step)}`;
  if(seen.has(key))continue;seen.add(key);
  if(Math.abs(x-b.x)>b.w/2+2||Math.abs(z-b.z)>b.d/2+2||intersects(x,z,.37,obstacles))continue;
  if(Math.hypot(x-end.x,z-end.z)<.45)return true;
  for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]])queue.push([x+dx,z+dz]);
 }
 return false;
}
test('all neighborhood buildings have a real entrance and enclosed sides',()=>{
 assert.equal(BUILDINGS.length,23);
 for(const b of BUILDINGS){const walls=wallPlan(b),door=entrance(b);
  assert.equal(intersects(door.x,door.z,.37,walls),false,b.id);
  assert.equal(intersects(b.x+b.w/2,b.z,.37,walls),true,b.id);
  assert.equal(intersects(b.x,b.z-b.dir*b.d/2,.37,walls),true,b.id);
 }
});
test('furnished interiors allow walking from the street to the room center and back',()=>{
 const {obstacles,buildings}=fixture();
 for(const b of BUILDINGS){const door=entrance(b),outside={x:door.x,z:door.z+b.dir*1.5};
  assert.ok(reachable(outside,b,b,obstacles),`${b.id}: entry`);
  assert.ok(reachable(b,outside,b,obstacles),`${b.id}: exit`);
 }
 for(const service of buildings.services){const b=service.building,door=entrance(b);
  assert.ok(reachable({x:door.x,z:door.z+b.dir*1.5},service,b,obstacles),`${b.id}: counter`);
  assert.ok(Math.abs(service.z-b.z)<b.d/2-2);
 }
 buildings.dispose();
});
test('room detection drives interior lighting and returns outdoors on exit',()=>{
 const {scene,buildings}=fixture();
 for(const b of BUILDINGS)assert.equal(buildings.update(new T.Vector3(b.x,.1,b.z))?.id,b.id);
 assert.equal(buildings.update(new T.Vector3(0,.1,0)),undefined);
 assert.equal(scene.children.filter(o=>o instanceof T.PointLight&&o.visible).length,0);
 buildings.dispose();
});
