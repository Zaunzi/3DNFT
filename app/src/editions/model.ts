import {assetKey,validateLocation,type NFTAsset} from '../nfts/model.ts';
import type {LocalTransform} from '../items/model.ts';
export interface EditionLocation extends LocalTransform {parcelId:number;mountWallId?:number}
export interface EditionAttachment {id:bigint;asset:NFTAsset;quantity:bigint;depositor:string;location:EditionLocation}
export interface EditionProvider {
    enabled:boolean;
    balance(asset:NFTAsset,owner:string):Promise<bigint>;
    uri(asset:NFTAsset):Promise<string>;
    snapshot(parcel:number):Promise<EditionAttachment[]>;
    approved(asset:NFTAsset,owner:string):Promise<boolean>;
    approve(asset:NFTAsset):Promise<void>;
    attach(asset:NFTAsset,quantity:bigint,location:EditionLocation):Promise<void>;
    move(id:bigint,location:EditionLocation):Promise<void>;
    detach(id:bigint):Promise<void>;
}
export function validateEdition(asset:NFTAsset,quantity:bigint,location:EditionLocation){
    assetKey(asset);if(quantity<=0n||quantity>=1n<<256n)throw new Error('Quantity must be a positive uint256');
    validateLocation({kind:'parcel',...location});
}
/** ERC-1155 {id} uses lowercase hexadecimal padded to 64 digits, not decimal. */
export function editionURI(uri:string,id:bigint){if(id<0n||id>=1n<<256n)throw new Error('Invalid token ID');return uri.replaceAll('{id}',id.toString(16).padStart(64,'0'));}
