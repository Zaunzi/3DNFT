import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { MockParcelStateProvider, decodeMockParcel, MOCK_STORAGE_PREFIX } from '../src/blockchain/mockParcelState.ts';
import { objectToWorldPosition, worldToObjectPosition, validatePlacement, type ObjectPlacement } from '../src/objects/model.ts';
import { PersistentObjectLayer } from '../src/objects/persistentLayer.ts';
import { ObjectRegistry } from '../src/objects/registry.ts';
import { getTerrainHeight } from '../src/world/terrain.ts';
import { DEFAULT_SEED } from '../src/world/constants.ts';
const placement: ObjectPlacement = { objectType: 1, x: 1200, z: 2700, rotation: 9000 };
function storage() { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; }
test('world/local fixed point conversion round trips to centimeter precision', () => {
  for (const id of [0,742,4999]) for (const x of [142,1200,6258]) {
    const original = { x, z: 2700 }; const world = objectToWorldPosition(id,original);
    assert.deepEqual(worldToObjectPosition(id,world.x,world.z),original);
  }
  assert.throws(()=>validatePlacement({...placement,x:6399}));
  assert.throws(()=>validatePlacement({...placement,rotation:36000}));
  assert.throws(()=>validatePlacement({...placement,x:1000.2}));
});
test('mock authorization, reload persistence, removal, stable IDs and terrain isolation', async () => {
  const local = storage(); let owns = false;
  const provider = new MockParcelStateProvider(local,()=>owns);
  await assert.rejects(provider.addObject(742n,placement),/owner/); owns=true;
  const before = getTerrainHeight(2700,480,DEFAULT_SEED);
  const events: bigint[] = []; const stop = provider.subscribe(id=>events.push(id));
  await provider.addObject(742n,placement); await provider.addObject(742n,{...placement,x:1300});
  const restored = new MockParcelStateProvider(local,()=>true);
  assert.deepEqual(await restored.getObjects(742n),[{...placement,id:1},{...placement,x:1300,id:2}]);
  assert.deepEqual(await restored.getObjects(743n),[]);
  owns=false; await assert.rejects(provider.removeObject(742n,1),/owner/); owns=true;
  await provider.removeObject(742n,1); await provider.addObject(742n,placement);
  assert.deepEqual((await restored.getObjects(742n)).map(o=>o.id),[2,3]);
  await assert.rejects(provider.removeObject(742n,1),/no longer/);
  assert.equal(before,getTerrainHeight(2700,480,DEFAULT_SEED)); assert.equal(events.length,4); stop();
  assert.equal(decodeMockParcel(local.getItem(`${MOCK_STORAGE_PREFIX}742`)).nextId,3);
  assert.throws(()=>decodeMockParcel('{"schema":99}'));
});
test('mock caps state and reports persistence failures', async () => {
  const provider = new MockParcelStateProvider(storage(),()=>true);
  for(let i=0;i<128;i++) await provider.addObject(742n,placement);
  await assert.rejects(provider.addObject(742n,placement),/limit/);
  await provider.removeObject(742n,64); await provider.addObject(742n,placement);
  assert.equal((await provider.getObjects(742n)).at(-1)?.id,129);
  const blocked=new MockParcelStateProvider({getItem:()=>null,setItem:()=>{throw new Error('Quota exceeded');}},()=>true);
  await assert.rejects(blocked.addObject(742n,placement),/Quota/);
});
test('neighbor objects load, unload, and stale requests cannot resurrect meshes', async () => {
  const scene=new Scene(), registry=new ObjectRegistry();
  const requests: {id:bigint;resolve:(value: ({id:number}&ObjectPlacement)[])=>void}[]=[];
  const provider={getObjects:(id:bigint)=>new Promise<({id:number}&ObjectPlacement)[]>(resolve=>requests.push({id,resolve}))};
  const layer=new PersistentObjectLayer(scene,provider,registry,DEFAULT_SEED,()=>{});
  layer.sync([742,743]); assert.deepEqual(requests.map(r=>r.id),[742n,743n]);
  requests[1].resolve([{...placement,id:1}]); await Promise.resolve();
  assert.ok(layer.find(743,1));
  layer.sync([743]); requests[0].resolve([{...placement,id:9}]); await Promise.resolve(); assert.equal(layer.find(742,9),undefined);
  const old=layer.refresh(743), newer=layer.refresh(743);
  requests[3].resolve([{...placement,id:3}]); await newer;
  requests[2].resolve([{...placement,id:2}]); await old;
  assert.ok(layer.find(743,3)); assert.equal(layer.find(743,2),undefined);
  layer.dispose(); assert.equal(scene.children.length,0); registry.dispose();
});
