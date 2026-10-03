import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh} from 'three';
import {MockEditionProvider,BASEPAINT} from '../src/editions/mock.ts';
import {editionURI,validateEdition} from '../src/editions/model.ts';
import {EditionLayer} from '../src/editions/rendering.ts';
import {MetadataCache} from '../src/nfts/metadata.ts';
const alice='0x1111111111111111111111111111111111111111',bob='0x2222222222222222222222222222222222222222';
const asset={chainId:8453,contractAddress:BASEPAINT,tokenId:14n},location={parcelId:742,x:3200,z:3200,rotation:0};
function setup(){let account=alice,owner=alice,fail=false;const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('quota');values.set(k,v);}};const create=()=>new MockEditionProvider(storage,()=>account,id=>[742,743].includes(id)&&account===owner,8453,alice);return {create,values,sell:()=>{owner=bob;},bob:()=>{account=bob;},fail:()=>{fail=true;}};}
test('ERC1155 URI substitution uses 64 lowercase hex digits',()=>{assert.equal(editionURI('https://basepaint.xyz/api/art/{id}',14n),'https://basepaint.xyz/api/art/'+'0'.repeat(63)+'e');assert.throws(()=>editionURI('x',-1n));assert.throws(()=>validateEdition(asset,0n,location));assert.throws(()=>validateEdition(asset,1n,{...location,x:149}));});
test('approval, quantity, reload, move and parcel inheritance conserve editions',async()=>{
 const s=setup(),p=s.create();await assert.rejects(p.attach(asset,1n,location),/Approve/);await p.approve(asset);await p.attach(asset,2n,location);
 assert.equal(await p.balance(asset,alice),1n);assert.equal((await s.create().snapshot(742))[0].quantity,2n);
 await assert.rejects(p.attach(asset,2n,location),/balance/);await p.move(1n,{...location,parcelId:743});assert.equal((await p.snapshot(742)).length,0);
 s.sell();await assert.rejects(p.detach(1n),/owner/);s.bob();await p.detach(1n);assert.equal(await p.balance(asset,bob),2n);assert.equal(await p.balance(asset,alice),1n);assert.equal((await p.snapshot(743)).length,0);await assert.rejects(p.detach(1n));
});
test('failed persistence leaves balances and canonical records untouched',async()=>{const s=setup(),p=s.create();await p.approve(asset);const before=[...s.values];s.fail();await assert.rejects(p.attach(asset,1n,location),/quota/);assert.deepEqual([...s.values],before);assert.equal(await p.balance(asset,alice),3n);});
test('streamed editions have separate record identities, grounding and disposal',async()=>{
 const s=setup(),p=s.create();await p.approve(asset);await p.attach(asset,1n,location);await p.attach(asset,1n,location);
 const scene=new Scene(),layer=new EditionLayer(scene,p,7422026n,new MetadataCache(a=>p.uri(a),'https://ipfs.io/ipfs/'),()=>{});
 layer.sync([742]);await layer.refresh(742);const entities:bigint[]=[];let disposed=0;
 layer.roots()[0].traverse(o=>{if(o.userData.kind==='edition')entities.push(o.userData.entity.editionId);if(o instanceof Mesh)o.geometry.addEventListener('dispose',()=>disposed++);});
 assert.deepEqual(entities,[1n,2n]);layer.updateGrounding(()=>20);layer.roots()[0].traverse(o=>{if(o.userData.kind==='edition')assert.equal(o.position.y,20);});
 layer.sync([]);assert.equal(layer.count(),0);assert.ok(disposed>0);layer.dispose();assert.equal(scene.children.length,0);
});
