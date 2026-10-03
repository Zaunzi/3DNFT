import {getAddress} from 'viem';
import type * as THREE from 'three';
import {NFTLayer,NFTRepresentationRegistry} from '../nfts/rendering.ts';
import {MetadataCache} from '../nfts/metadata.ts';
import type {EditionProvider} from './model.ts';
/** Share visual machinery, not ERC-721 ownership APIs. Each escrow record remains a separate instance. */
export class EditionLayer extends NFTLayer {
    constructor(scene:THREE.Scene,provider:EditionProvider,seed:bigint,cache:MetadataCache,report:(m:string)=>void){
        super(scene,{snapshot:async parcel=>({containers:[],doors:[],attachments:(await provider.snapshot(parcel)).map(a=>({asset:a.asset,depositor:getAddress(a.depositor),location:{kind:'parcel' as const,...a.location},editionId:a.id,quantity:a.quantity}))})},new NFTRepresentationRegistry(),seed,cache,report);
    }
    override async refresh(parcel:number){await super.refresh(parcel);this.parcels.get(parcel)?.group.traverse(o=>{if(o.userData.kind==='nft')o.userData.kind='edition';});}

}
