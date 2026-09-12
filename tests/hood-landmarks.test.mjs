import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {LANDMARKS,buildLandmarks} from '../src/lib/hood-landmarks.ts';
import {BUILDINGS,buildNeighborhood} from '../src/lib/hood-buildings.ts';
import {intersects} from '../src/lib/hood-state.ts';
function fixture(){const scene=new T.Scene(),obstacles=[],solid=[],windows=[],signs=[];
 const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
 const box=(w,h,d,x,y,z,c,parent=scene)=>{const m=new T.Mesh(geometry,material);m.scale.set(w,h,d);m.position.set(x,y,z);parent.add(m);if([0x38545c,0x3d5660].includes(c))windows.push({x,y,z,w,h});return m;};
 const sign=(text,x,y,z,w)=>{const m=box(w,w/6.4,.01,x,y,z,0);signs.push({text,x,y,z,w,h:w/6.4});return m;};
 return {scene,obstacles,solid,windows,signs,box,sign};}
test('apartment and shop name boards do not intersect window rectangles',()=>{const f=fixture();buildNeighborhood(f.scene,f.box,f.sign,f.obstacles,f.solid);
 for(const b of BUILDINGS){const s=f.signs.find(s=>s.text===b.name);assert.ok(s);for(const w of f.windows){if(Math.abs(w.z-s.z)>.3)continue;assert.ok(Math.abs(w.x-s.x)>=(w.w+s.w)/2||Math.abs(w.y-s.y)>=(w.h+s.h)/2,`${b.name}: window crosses sign`);}}
});
test('garage entrance, center aisle and empty parking bay clear a car footprint',()=>{const f=fixture();const landmarks=buildLandmarks(f.scene,f.box,f.sign,f.obstacles,f.solid);const b=LANDMARKS.find(b=>b.id==='parking');
 for(let z=-17;z<=30;z+=.25)assert.equal(intersects(b.x,b.z+z,1.25,f.obstacles),false);
 for(let x=0;x<=12;x+=.25)assert.equal(intersects(b.x+x,b.z+8,1.25,f.obstacles),false);
 landmarks.dispose();
});
test('mall counters are reachable on foot from its street entrance',()=>{const f=fixture(),landmarks=buildLandmarks(f.scene,f.box,f.sign,f.obstacles,f.solid),b=LANDMARKS[0];
 const queue=[[b.x,b.z+25]],seen=new Set(),visited=[];
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i],key=`${x},${z}`;if(seen.has(key))continue;seen.add(key);if(Math.abs(x-b.x)>22||Math.abs(z-b.z)>26||intersects(x,z,.37,f.obstacles))continue;visited.push([x,z]);for(const [dx,dz]of [[.5,0],[-.5,0],[0,.5],[0,-.5]])queue.push([x+dx,z+dz]);}
 assert.equal(landmarks.services.length,3);for(const s of landmarks.services)assert.ok(visited.some(([x,z])=>Math.hypot(x-s.x,z-s.z)<.6),s.name);landmarks.dispose();
});
