import type {Address} from 'viem';
import type {ExperienceStore} from '../items/providers.ts';
import type {ItemPlacement} from '../items/model.ts';
/** Original escrow IDs occupy a separate, exactly representable namespace. */
export const LEGACY_TRINKET_ID=2**32;
export class TrinketCollections implements ExperienceStore {
 readonly enabled:boolean;
 private current:ExperienceStore;private legacy:ExperienceStore;private account:()=>Address|null|undefined;
 constructor(current:ExperienceStore,legacy:ExperienceStore,account:()=>Address|null|undefined){this.current=current;this.legacy=legacy;this.account=account;this.enabled=current.enabled;}
 async getBalance(owner:Address,id:bigint){return await this.current.getBalance(owner,id)+await this.legacy.getBalance(owner,id);}
 async getInventory(owner:Address){const [a,b]=await Promise.all([this.current.getInventory(owner),this.legacy.getInventory(owner)]);return a.map(row=>({...row,balance:row.balance+(b.find(old=>old.itemId===row.itemId)?.balance??0n)}));}
 async getItems(parcel:number){const [a,b]=await Promise.all([this.current.getItems(parcel),this.legacy.getItems(parcel)]);return [...a,...b.map(row=>({...row,id:row.id+LEGACY_TRINKET_ID}))];}
 private async holders(){const account=this.account();if(!account)return [];const result:ExperienceStore[]=[];for(const store of [this.current,this.legacy])if((await store.getInventory(account)).some(row=>row.balance>0n))result.push(store);return result;}
 async isEscrowApproved(){const stores=await this.holders();return stores.length>0&&(await Promise.all(stores.map(s=>s.isEscrowApproved()))).every(Boolean);}
 async approveEscrow(){for(const store of await this.holders())if(!await store.isEscrowApproved())await store.approveEscrow();}
 private async source(id:number,quantity:bigint){const account=this.account();if(!account)throw Error('Connect wallet first');if(quantity<=0n)throw Error('Positive quantity required');if(await this.current.getBalance(account,BigInt(id))>=quantity)return this.current;if(await this.legacy.getBalance(account,BigInt(id))>=quantity)return this.legacy;throw Error('Not enough tokens in one collection. Transfer each collection separately.');}
 async placeItem(parcel:number,item:ItemPlacement){await (await this.source(item.itemType,item.quantity)).placeItem(parcel,item);}
 async transferItem(to:Address,id:number,quantity:bigint){await (await this.source(id,quantity)).transferItem(to,id,quantity);}
 async pickupItem(parcel:number,id:number){if(id>=LEGACY_TRINKET_ID)await this.legacy.pickupItem(parcel,id-LEGACY_TRINKET_ID);else await this.current.pickupItem(parcel,id);}
 async evictItem(parcel:number,id:number){if(id>=LEGACY_TRINKET_ID)await this.legacy.evictItem(parcel,id-LEGACY_TRINKET_ID);else await this.current.evictItem(parcel,id);}
 async getPortals(){return [];}
 async placePortal(){throw Error('Trinkets do not create portals');}
 async removePortal(){throw Error('Trinkets do not create portals');}
}
