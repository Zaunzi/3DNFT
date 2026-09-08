import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DISTRICT_PLOTS,plannedSize,plotById,DISTRICT_ROADS,DISTRICT_WIDTH,DISTRICT_DEPTH} from '../src/lib/district.ts';
test('district gives all 1000 IDs unique, stable positions and exact 40/40/20 sizes',()=>{assert.equal(DISTRICT_PLOTS.length,1000);assert.equal(new Set(DISTRICT_PLOTS.map(p=>p.id)).size,1000);assert.equal(new Set(DISTRICT_PLOTS.map(p=>`${p.x}:${p.z}`)).size,1000);for(const [size,count]of [[0,400],[1,400],[2,200]])assert.equal(DISTRICT_PLOTS.filter(p=>p.size===size).length,count);for(let id=1;id<=1000;id++)assert.equal(plotById(id).size,plannedSize(id));assert.throws(()=>plotById(0));assert.throws(()=>plotById(1001))});

test('compact district keeps parcel footprints separate from each other and streets',()=>{
 const rects=DISTRICT_PLOTS.map(p=>{const w=[24,Math.sqrt(108)*4,Math.sqrt(216)*4][p.size]+.32;return {...p,w,d:w*.77+.08}});
 const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2;
 for(let i=0;i<rects.length;i++){for(let j=i+1;j<rects.length;j++)assert.ok(!overlap(rects[i],rects[j]),`Plots ${rects[i].id} and ${rects[j].id} overlap`);for(const road of DISTRICT_ROADS)assert.ok(!overlap(rects[i],road));}
 assert.ok(DISTRICT_ROADS.some(r=>r.w===12));assert.ok(DISTRICT_ROADS.some(r=>r.d===12));assert.ok(DISTRICT_WIDTH*DISTRICT_DEPTH<3100*1960*.4);
});
