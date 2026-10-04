import {encodeAbiParameters,keccak256,parseAbi,type Address} from 'viem';
import type {OnchainParcelStateProvider} from '../blockchain/client.ts';
import type {InjectedWallet} from '../blockchain/wallet.ts';
import type {NFTAsset} from './model.ts';

export interface ArtPose {parcelId:number;x:number;z:number;rotation:number;mountWallId?:number}
export const artMountAbi=parseAbi([
 'function land() view returns(address)', 'function parcels() view returns(address)',
 'function nfts() view returns(address)', 'function editions() view returns(address)',
 'function get721(address,uint256) view returns((bool saved,uint32 wallId))',
 'function get1155(uint256) view returns((bool saved,uint32 wallId))',
 'function set721(address,uint256,bytes32,uint32)', 'function set1155(uint256,bytes32,uint32)',
 'error Unauthorized()', 'error AttachmentChanged()', 'error InvalidWall()',
]);
export function artPoseHash(l:ArtPose,edition=false){
 return edition?keccak256(encodeAbiParameters([{type:'uint16'},{type:'uint16'},{type:'uint16'},{type:'uint16'}],[l.parcelId,l.x,l.z,l.rotation])):
 keccak256(encodeAbiParameters([{type:'uint16'},{type:'uint32'},{type:'uint16'},{type:'uint16'},{type:'uint16'}],[l.parcelId,0,l.x,l.z,l.rotation]));
}
export class MountSaveError extends Error {
 readonly retry:()=>Promise<void>;
 constructor(retry:()=>Promise<void>){super('Your NFT placement confirmed, but saving its wall mount did not. Open NFTs / Containers and choose “Finish saving art mount”. Your NFT is safe.');this.retry=retry;}
}
export class OnchainArtMounts {
 readonly client:OnchainParcelStateProvider['client'];readonly wallet:InjectedWallet;readonly address:Address;
 constructor(client:OnchainParcelStateProvider['client'],wallet:InjectedWallet,address:Address){this.client=client;this.wallet=wallet;this.address=address;}
 async validate(bindings:{land:Address;parcels:Address;nfts:Address;editions:Address}){
  for(const key of ['land','parcels','nfts','editions'] as const){const value=await this.client.readContract({address:this.address,abi:artMountAbi,functionName:key});if(value.toLowerCase()!==bindings[key].toLowerCase())throw new Error('Art mount contract binding mismatch');}
 }
 async read(asset:NFTAsset,id?:bigint){
  const result=id===undefined?await this.client.readContract({address:this.address,abi:artMountAbi,functionName:'get721',args:[asset.contractAddress,asset.tokenId]}):await this.client.readContract({address:this.address,abi:artMountAbi,functionName:'get1155',args:[id]});
  return result.saved?result.wallId:undefined;
 }
 async save(asset:NFTAsset|bigint,l:ArtPose){
  if(l.mountWallId===undefined)return;
  const wallId=l.mountWallId;
  const save=async()=>{
   const wallet=await this.wallet.forChain(this.client.chain.id);
   const args=typeof asset==='bigint'?[asset,artPoseHash(l,true),wallId] as const:[asset.contractAddress,asset.tokenId,artPoseHash(l),wallId] as const;
   const {request}=await this.client.simulateContract({address:this.address,abi:artMountAbi,functionName:typeof asset==='bigint'?'set1155':'set721',args,account:wallet.account});
   const fresh=await this.wallet.forChain(this.client.chain.id);if(fresh.account.address!==wallet.account.address)throw new Error('Wallet changed');
   const hash=await fresh.writeContract({...request,chain:this.client.chain});
   if((await this.client.waitForTransactionReceipt({hash})).status!=='success')throw new Error('Art mount save reverted');
  };
  try{await save();}catch{throw new MountSaveError(save);}
 }
}
