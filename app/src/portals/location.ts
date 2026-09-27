import { isAddress, type Address } from 'viem';
import { parseTokenId } from '../world/coordinates.ts';
export interface NFTWorldLocation { chainId: number; contractAddress: Address; tokenId: bigint }
export type PortalDestination = { kind:'INTERNAL_ATLAS'; tokenId:bigint } | { kind:'EXTERNAL_NFT'; location:NFTWorldLocation } | { kind:'URL'; url:string };
export function resolveInternalDestination(destination:PortalDestination,current:NFTWorldLocation):NFTWorldLocation {
  if(destination.kind!=='INTERNAL_ATLAS')throw new Error('External destinations are not supported by this runtime. No automatic navigation performed.');
  parseTokenId(destination.tokenId.toString());return {...current,tokenId:destination.tokenId};
}
export function locationFromURL(url:URL,collection:Omit<NFTWorldLocation,'tokenId'>):NFTWorldLocation {
  const chain=url.searchParams.get('chain'),contract=url.searchParams.get('contract');
  if(chain!==null&&(!/^\d+$/.test(chain)||Number(chain)!==collection.chainId))throw new Error('This URL names an unsupported chain.');
  if(contract!==null&&(!isAddress(contract)||contract.toLowerCase()!==collection.contractAddress.toLowerCase()))throw new Error('This URL names an unsupported NFT collection.');
  return {...collection,tokenId:BigInt(parseTokenId(url.searchParams.get('tokenId')))};
}
export function locationURL(url:URL,location:NFTWorldLocation):string {const next=new URL(url);next.searchParams.set('tokenId',location.tokenId.toString());if(next.searchParams.has('chain'))next.searchParams.set('chain',String(location.chainId));if(next.searchParams.has('contract'))next.searchParams.set('contract',location.contractAddress);return next.href;}
