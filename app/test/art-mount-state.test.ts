import test from 'node:test';
import assert from 'node:assert/strict';
import {AbiCoder,keccak256} from 'ethers';
import {OnchainArtMounts,MountSaveError,artPoseHash} from '../src/nfts/mountState.ts';
const address='0x1111111111111111111111111111111111111111';
const asset={chainId:8453,contractAddress:address,tokenId:1n} as const;
const pose={parcelId:1,x:3200,z:3228,rotation:0,mountWallId:2};
test('pose fingerprints match Solidity struct encoding for both custody schemas',()=>{
 const abi=AbiCoder.defaultAbiCoder();
 assert.equal(artPoseHash(pose),keccak256(abi.encode(['tuple(uint16,uint32,uint16,uint16,uint16)'],[[1,0,3200,3228,0]])));
 assert.equal(artPoseHash(pose,true),keccak256(abi.encode(['tuple(uint16,uint16,uint16,uint16)'],[[1,3200,3228,0]])));
 assert.notEqual(artPoseHash(pose),artPoseHash({...pose,parcelId:2}));
});
test('failed second confirmation exposes a mount-only retry for ERC721 and ERC1155',async()=>{
 for(const id of [undefined,11n]){
  let reject=true,writes=0;const calls:any[]=[];
  const wallet={forChain:async()=>({account:{address},writeContract:async()=>{writes++;if(reject)throw Error('Rejected');return '0xabc';}})};
  const client={chain:{id:8453},simulateContract:async(args:any)=>{calls.push(args);return {request:args};},waitForTransactionReceipt:async()=>({status:'success'})};
  const mounts=new OnchainArtMounts(client as any,wallet as any,address);
  let pending:MountSaveError|undefined;try{await mounts.save(id??asset,pose);}catch(e){assert.ok(e instanceof MountSaveError);pending=e;}
  assert.ok(pending);reject=false;await pending.retry();assert.equal(writes,2);
  assert.ok(calls.every(c=>c.functionName===(id===undefined?'set721':'set1155')));
  assert.equal(calls[0].args.at(-1),2);assert.deepEqual(calls[0].args,calls[1].args);
 }
});
test('reading mounts distinguishes legacy attachments from explicit ground placement',async()=>{
 let value={saved:false,wallId:0};const client={readContract:async()=>value};
 const mounts=new OnchainArtMounts(client as any,{} as any,address);
 assert.equal(await mounts.read(asset),undefined);value={saved:true,wallId:0};assert.equal(await mounts.read(asset),0);
 value={saved:true,wallId:3};assert.equal(await mounts.read(asset,2n),3);
});
