import {getAddress} from 'viem';
import {assetKey,type NFTAsset} from '../nfts/model.ts';
import {validateEdition,type EditionProvider,type EditionLocation,type EditionAttachment} from './model.ts';
export const BASEPAINT='0xBa5e05cb26b78eDa3A2f8e3b3814726305dcAc83' as const;
interface Data {nextId:string;balances:Record<string,string>;approvals:string[];attachments:EditionAttachment[]}
export class MockEditionProvider implements EditionProvider {
    enabled=true;
    readonly key:string;
    private storage:{getItem(k:string):string|null;setItem(k:string,v:string):void};
    private account:()=>string|null;private owns:(id:number)=>boolean;private chainId:number;private initialOwner:string;
    constructor(storage:MockEditionProvider['storage'],account:()=>string|null,owns:(id:number)=>boolean,chainId:number,initialOwner:string){this.storage=storage;this.account=account;this.owns=owns;this.chainId=chainId;this.initialOwner=initialOwner;this.key=`doodverse:editions:${chainId}:v1`;}
    private balanceKey(a:NFTAsset,owner:string){if(a.chainId!==this.chainId)throw new Error('Wrong asset chain');return `${getAddress(owner).toLowerCase()}:${assetKey(a)}`;}
    private read():Data {const raw=this.storage.getItem(this.key);return raw?JSON.parse(raw,(_k,v)=>v&&typeof v==='object'&&Object.keys(v).length===1&&typeof v.$bigint==='string'?BigInt(v.$bigint):v):{nextId:'0',balances:{[this.balanceKey({chainId:this.chainId,contractAddress:BASEPAINT,tokenId:14n},this.initialOwner)]:'3'},approvals:[],attachments:[]};}
    private async mutate(fn:(d:Data,owner:string)=>void){const apply=()=>{const owner=this.account();if(!owner)throw new Error('Connect mock wallet');const d=this.read();fn(d,owner);this.storage.setItem(this.key,JSON.stringify(d,(_k,v)=>typeof v==='bigint'?{$bigint:String(v)}:v));};if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request(this.key,apply);else apply();}
    private owner(parcel:number){if(!this.owns(parcel))throw new Error('Only the current parcel owner may modify attachments');}
    async balance(a:NFTAsset,owner:string){return BigInt(this.read().balances[this.balanceKey(a,owner)]??'0');}
    async uri(a:NFTAsset){assetKey(a);return 'data:application/json;utf8,'+encodeURIComponent(JSON.stringify({name:`Mock edition #${a.tokenId}`,description:'Development ERC-1155 edition. No real tokens are held in mock mode.',attributes:[]}));}
    async snapshot(parcel:number){return this.read().attachments.filter(a=>a.location.parcelId===parcel);}
    private approval(a:NFTAsset,owner:string){this.balanceKey(a,owner);return `${owner.toLowerCase()}:${a.contractAddress.toLowerCase()}`;}
    async approved(a:NFTAsset,owner:string){return this.read().approvals.includes(this.approval(a,owner));}
    async approve(a:NFTAsset){await this.mutate((d,owner)=>{const key=this.approval(a,owner);if(!d.approvals.includes(key))d.approvals.push(key);});}
    async attach(a:NFTAsset,q:bigint,l:EditionLocation){validateEdition(a,q,l);await this.mutate((d,owner)=>{this.owner(l.parcelId);if(!d.approvals.includes(this.approval(a,owner)))throw new Error('Approve collection first');const key=this.balanceKey(a,owner),balance=BigInt(d.balances[key]??'0');if(balance<q)throw new Error('Insufficient balance');if(d.attachments.filter(e=>e.location.parcelId===l.parcelId).length>=64)throw new Error('Parcel full');const id=BigInt(d.nextId)+1n;d.nextId=String(id);d.balances[key]=String(balance-q);d.attachments.push({id,asset:a,quantity:q,depositor:owner,location:l});});}
    async move(id:bigint,l:EditionLocation){await this.mutate(d=>{const a=d.attachments.find(a=>a.id===id);if(!a)throw new Error('Unknown attachment');validateEdition(a.asset,a.quantity,l);this.owner(a.location.parcelId);this.owner(l.parcelId);if(l.parcelId!==a.location.parcelId&&d.attachments.filter(a=>a.location.parcelId===l.parcelId).length>=64)throw new Error('Parcel full');a.location=l;});}
    async detach(id:bigint){await this.mutate((d,owner)=>{const i=d.attachments.findIndex(a=>a.id===id);if(i<0)throw new Error('Unknown attachment');const a=d.attachments[i];this.owner(a.location.parcelId);const key=this.balanceKey(a.asset,owner);d.balances[key]=String(BigInt(d.balances[key]??'0')+a.quantity);d.attachments.splice(i,1);});}
}
