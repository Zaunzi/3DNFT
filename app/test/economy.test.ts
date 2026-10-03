import test from 'node:test';
import assert from 'node:assert/strict';
import {MockInventoryProvider,EXPERIENCE_KEY} from '../src/items/mockInventory.ts';
import {MockEconomy} from '../src/economy/mock.ts';
import {replenish,REFILL_MS} from '../src/economy/model.ts';
import {MOCK_STORAGE_PREFIX} from '../src/blockchain/mockParcelState.ts';
import {getTerrainHeight} from '../src/world/terrain.ts';
const alice='0x1111111111111111111111111111111111111111',bob='0x2222222222222222222222222222222222222222';
const foundation={objectType:7 as const,x:3200,z:3200,rotation:0,y:100};
function setup(){let owner=alice,account=alice,time=100000,fail=false;const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw new Error('quota');map.set(k,v);}};const owns=(id:number)=>id===742&&account===owner;const ledger=new MockInventoryProvider(storage,()=>account as typeof alice,owns);const create=()=>new MockEconomy(ledger,storage,owns,()=>time);return {ledger,map,create,clock:(t:number)=>{time=t;},sell:()=>{owner=bob;},bob:()=>{account=bob;},fail:()=>{fail=true;}};}
test('harvest shares capped reserves across scenery, persists and carries depletion through parcel sale',async()=>{
 const s=setup(),p=s.create(),height=getTerrainHeight(2700,480,7422026n);assert.equal(p.reserves(742).wood.available,40);
 assert.equal(await p.harvest(742,'wood'),40);
 assert.equal(p.reserves(742).stone.available,40);
 assert.equal(await s.ledger.getBalance(alice,2n),40n);s.clock(120000);await assert.rejects(p.harvest(742,'wood'),/depleted/);assert.equal(s.create().reserves(742).wood.available,0);
 s.sell();await assert.rejects(p.harvest(742,'stone'),/owner/);s.bob();assert.equal(p.reserves(742).wood.available,0);s.clock(130000);assert.equal(await p.harvest(742,'wood'),1);assert.equal(await s.ledger.getBalance(bob,2n),1n);assert.equal(await s.ledger.getBalance(alice,2n),40n);
 assert.equal(getTerrainHeight(2700,480,7422026n),height);await assert.rejects(p.harvest(743,'stone'),/owner/);
});
test('cooldowns, refill cap and clock rollback cannot grant extra resources',async()=>{
 const s=setup(),p=s.create();await p.harvest(742,'wood');await assert.rejects(p.harvest(742,'stone'),/Wait/);s.clock(90000);await assert.rejects(p.harvest(742,'wood'),/Wait/);s.clock(100000+REFILL_MS*100);assert.equal(p.reserves(742).wood.available,40);
 assert.deepEqual(replenish({available:3,updatedAt:100},50),{available:3,updatedAt:100});
});
test('building debits materials and writes objects atomically; removals never mint refunds',async()=>{
 const s=setup(),p=s.create();await assert.rejects(p.addObject(742n,foundation),/Need/);assert.deepEqual(await p.getObjects(742n),[]);
 await p.harvest(742,'wood');s.clock(102000);await p.harvest(742,'stone');await p.addObject(742n,foundation);
 assert.equal(await s.ledger.getBalance(alice,2n),32n);assert.equal(await s.ledger.getBalance(alice,1n),36n);assert.equal((await s.create().getObjects(742n)).length,1);
 s.sell();await assert.rejects(p.removeObject(742n,1),/owner/);s.bob();await p.removeObject(742n,1);assert.equal(await s.ledger.getBalance(bob,2n),0n);
});
test('legacy buildings migrate without charges and failed writes preserve balances, reserve and IDs',async()=>{
 const s=setup();s.map.set(MOCK_STORAGE_PREFIX+'742',JSON.stringify({schema:1,nextId:5,objects:[{...foundation,id:5}]}));const p=s.create();assert.equal((await p.getObjects(742n))[0].id,5);
 await s.ledger.grantDevItem(2,20n);await s.ledger.grantDevItem(1,20n);const before=s.map.get(EXPERIENCE_KEY);s.fail();await assert.rejects(p.addObject(742n,foundation),/quota/);await assert.rejects(p.harvest(742,'wood'),/quota/);assert.equal(s.map.get(EXPERIENCE_KEY),before);assert.equal((await p.getObjects(742n)).length,1);
});

test('one harvest collects the full partially replenished reserve without affecting the other resource',async()=>{
 const s=setup(),p=s.create();assert.equal(await p.harvest(742,'stone'),40);
 s.clock(100000+REFILL_MS*7);assert.equal(await p.harvest(742,'stone'),7);
 assert.equal(p.reserves(742).stone.available,0);assert.equal(p.reserves(742).wood.available,40);
 assert.equal(await s.ledger.getBalance(alice,1n),47n);
});
