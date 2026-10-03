import test from 'node:test';
import assert from 'node:assert/strict';
import {TrinketCollections,LEGACY_TRINKET_ID} from '../src/trinkets/collections.ts';
import {MockTrinketProvider} from '../src/trinkets/mock.ts';
const alice='0x1111111111111111111111111111111111111111',bob='0x2222222222222222222222222222222222222222';
test('original and public trinket escrow IDs stay distinct and route withdrawals to their collection',async()=>{
 let account:typeof alice|typeof bob=alice,owner:string=alice;
 const make=()=>{const data=new Map<string,string>();return new MockTrinketProvider({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}},()=>account,()=>account===owner);};
 const current=make(),legacy=make(),combined=new TrinketCollections(current,legacy,()=>account);
 const pose={itemType:1,quantity:1n,x:3200,z:3200,rotation:0};
 await current.grantDevItem(1,1n);await legacy.grantDevItem(1,1n);
 await combined.placeItem(1,pose);assert.equal((await current.getItems(1)).length,1);assert.equal((await legacy.getItems(1)).length,0);
 await combined.placeItem(1,pose);assert.deepEqual((await combined.getItems(1)).map(r=>r.id),[1,LEGACY_TRINKET_ID+1]);
 assert.equal(await combined.getBalance(alice,1n),0n);
 owner=bob;await assert.rejects(combined.pickupItem(1,LEGACY_TRINKET_ID+1));account=bob;
 await combined.pickupItem(1,LEGACY_TRINKET_ID+1);assert.equal(await legacy.getBalance(bob,1n),1n);assert.equal(await current.getBalance(bob,1n),0n);
 await combined.evictItem(1,1);assert.equal(await current.getBalance(bob,1n),1n);assert.equal((await combined.getItems(1)).length,0);
});
