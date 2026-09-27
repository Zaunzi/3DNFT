import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinateToTokenId, getNeighbors, nearbyTokenIds, parseTokenId, tokenIdToCoordinate, worldToParcel } from '../src/world/coordinates.ts';
import { DEFAULT_SEED, SEGMENTS } from '../src/world/constants.ts';
import { getGroundHeight, getTerrainHeight } from '../src/world/terrain.ts';
import { createTerrainGeometry } from '../src/world/parcel.ts';
import { getVegetation } from '../src/world/vegetation.ts';
import { WorldManager } from '../src/world/worldManager.ts';
import { Scene } from 'three';
test('all 5000 coordinates round trip; edges never wrap', () => {
  for (let id = 0; id < 5000; id++) { const c = tokenIdToCoordinate(id); assert.equal(coordinateToTokenId(c.x, c.z), id); }
  assert.deepEqual(tokenIdToCoordinate(742), { x: 42, z: 7 });
  assert.equal(getNeighbors(tokenIdToCoordinate(99)).east, null);
  assert.equal(getNeighbors({x:0,z:0}).north, null);
  for (const id of [-1, 5000, NaN, 1.5]) assert.throws(() => tokenIdToCoordinate(id));
  for (const text of ['', '-1', '1.5', '5000', 'Infinity']) assert.throws(() => parseTokenId(text));
  assert.equal(parseTokenId(null), 742); assert.equal(coordinateToTokenId(-1, 0), null);
});
test('global boundary crossing and bounded neighborhood', () => {
  const c = worldToParcel(43 * 64, 7 * 64); assert.equal(coordinateToTokenId(c.x, c.z), 743);
  assert.equal(nearbyTokenIds({x:42,z:7},2).length,25); assert.equal(nearbyTokenIds({x:0,z:0},2).length,9);
});
test('deterministic terrain, high seed bits and decorations', () => {
  const sample = () => Array.from({length:50},(_,i) => getTerrainHeight(i*3.13,-i*0.82,DEFAULT_SEED));
  assert.deepEqual(sample(),sample());
  assert.notEqual(getTerrainHeight(17,23,1n),getTerrainHeight(17,23,(1n << 200n)+1n));
  assert.deepEqual(getVegetation({x:42,z:7},DEFAULT_SEED),getVegetation({x:42,z:7},DEFAULT_SEED));
});
test('actual mesh heights, normals and colors match east/south shared edges', () => {
  for (const id of [0,742,2448,4898]) {
    const a = createTerrainGeometry(id,DEFAULT_SEED);
    for (const [other, south] of [[id+1,false],[id+100,true]] as const) {
      const b = createTerrainGeometry(other,DEFAULT_SEED);
      for(let i=0;i<=SEGMENTS;i++) {
        const ai = south ? SEGMENTS*(SEGMENTS+1)+i : i*(SEGMENTS+1)+SEGMENTS, bi = south ? i : i*(SEGMENTS+1);
        assert.equal(a.getAttribute('position').getY(ai), b.getAttribute('position').getY(bi));
        for(const name of ['normal','color']) for(let j=0;j<3;j++) assert.equal(a.getAttribute(name).array[ai*3+j],b.getAttribute(name).array[bi*3+j]);
      } b.dispose();
    } a.dispose();
  }
});
test('collision follows both mesh triangles', () => {
  const x=100,z=202,s=DEFAULT_SEED,a=getTerrainHeight(x,z,s),b=getTerrainHeight(x+2,z,s),c=getTerrainHeight(x,z+2,s),d=getTerrainHeight(x+2,z+2,s);
  assert.equal(getGroundHeight(x+.5,z+.5,s),a+(b-a)*.25+(c-a)*.25);
  assert.equal(getGroundHeight(x+1.5,z+1.5,s),d+(c-d)*.25+(b-d)*.25);
});
test('streaming retains neighbors, evicts and disposes', () => {
  const scene=new Scene(), world=new WorldManager(scene,DEFAULT_SEED); world.update(742);
  const retained=world.parcels.get(743), evicted=world.parcels.get(740)!; let disposed=false;
  const original=evicted.dispose; evicted.dispose=()=>{disposed=true;original();};
  world.update(743); assert.equal(world.parcels.get(743),retained); assert.equal(disposed,true); assert.equal(world.parcels.size,25);
  world.setBorders(false); assert.ok([...world.parcels.values()].every(p=>!p.border.visible));
  world.update(0); assert.equal(world.parcels.size,9); world.dispose(); assert.equal(scene.children.length,0);
});
