import { isAddress, type Address } from 'viem';
import type { LocalStorageLike } from '../blockchain/mockParcelState.ts';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
import { ITEM_DEFINITIONS, itemDefinition } from './definitions.ts';
import { MAX_PORTALS, MAX_WORLD_ITEMS, validateItemPlacement, validatePortal, type ItemPlacement, type LocalTransform, type Portal, type AttachedWorldItem } from './model.ts';
import type { ExperienceStore } from './providers.ts';

export const EXPERIENCE_KEY = 'atlas:7422026:generator1:items-portals:v1';
interface StoredItem extends Omit<AttachedWorldItem, 'quantity'> { quantity: string }
export interface Data { schema: 1; balances: Record<string, Record<string, string>>; parcels: Record<string, { nextItemId: number; nextPortalId: number; items: StoredItem[]; portals: Portal[] }>; nftState?: import('../nfts/mock.ts').NFTData }
const empty = (): Data => ({ schema: 1, balances: {}, parcels: {} });
const uint = (value: unknown) => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) && BigInt(value) < 1n << 256n;
export function decodeExperience(raw: string | null): Data {
  if (raw === null) return empty();
  const data = JSON.parse(raw) as Data;
  if (data.schema !== 1 || !data.balances || !data.parcels) throw new Error('Invalid item storage schema');
  for (const [owner, balances] of Object.entries(data.balances)) {
    if (!isAddress(owner)) throw new Error('Invalid inventory owner');
    for (const [id, amount] of Object.entries(balances)) { itemDefinition(Number(id)); if (!uint(amount)) throw new Error('Invalid inventory balance'); }
  }
  for (const [id, parcel] of Object.entries(data.parcels)) {
    if (!/^\d+$/.test(id)) throw new Error('Invalid parcel key'); tokenIdToCoordinate(Number(id));
    if (![parcel.nextItemId, parcel.nextPortalId].every(value=>Number.isInteger(value)&&value>=0&&value<=0xffffffff) || !Array.isArray(parcel.items) || parcel.items.length > MAX_WORLD_ITEMS || !Array.isArray(parcel.portals) || parcel.portals.length > MAX_PORTALS) throw new Error('Invalid instance list');
    const checkIds = (list: {id:number;parcelTokenId:number}[], max: number) => { const ids = new Set(); for(const item of list) { if(!Number.isInteger(item.id)||item.id<=0||item.id>max||ids.has(item.id)||item.parcelTokenId!==Number(id)) throw new Error('Invalid instance identity'); ids.add(item.id); } };
    checkIds(parcel.items,parcel.nextItemId); checkIds(parcel.portals,parcel.nextPortalId);
    for(const item of parcel.items) { if(!uint(item.quantity)||!isAddress(item.depositor)) throw new Error('Invalid escrow item'); validateItemPlacement({...item,quantity:BigInt(item.quantity)}); }
    parcel.portals.forEach(validatePortal);
  }
  return data;
}
/** One localStorage commit contains both inventory and world changes: no half-applied mock transfers. */
export class MockInventoryProvider implements ExperienceStore {
  readonly enabled = true;
  private storage: LocalStorageLike; private address: () => Address | null; private owns: (id:number)=>boolean;
  private listeners = new Set<()=>void>();
  constructor(storage: LocalStorageLike, address:()=>Address|null, owns:(id:number)=>boolean) { this.storage=storage;this.address=address;this.owns=owns; }
  private account() { const owner=this.address();if(!owner) throw new Error('Connect the mock owner first.');return owner; }
  read() { return decodeExperience(this.storage.getItem(EXPERIENCE_KEY)); }
  private parcel(data:Data,id:number) {tokenIdToCoordinate(id); return data.parcels[id]??= {nextItemId:0,nextPortalId:0,items:[],portals:[]};}
  async mutate(change:(data:Data,owner:Address)=>void) {
    const apply=()=>{ const owner=this.account(),data=this.read();change(data,owner); decodeExperience(JSON.stringify(data));this.storage.setItem(EXPERIENCE_KEY,JSON.stringify(data));for(const cb of this.listeners)cb(); };
    // Web Locks serialize same-origin tabs where supported; one commit remains atomic without them.
    if(typeof navigator!=='undefined'&&navigator.locks) await navigator.locks.request(EXPERIENCE_KEY,apply); else apply();
  }
  private amount(data:Data,owner:string,id:number) {return BigInt(data.balances[owner.toLowerCase()]?.[id]??'0');}
  credit(data:Data,owner:string,id:number,delta:bigint) {itemDefinition(id);const key=owner.toLowerCase(),amount=this.amount(data,key,id)+delta;if(amount<0n||amount>=1n<<256n)throw new Error('Insufficient balance or overflow');(data.balances[key]??={})[id]=amount.toString();}
  async getBalance(address:Address,itemId:bigint) {itemDefinition(Number(itemId));return this.amount(this.read(),address,Number(itemId));}
  async getInventory(address:Address) {const data=this.read();return ITEM_DEFINITIONS.map(item=>({itemId:item.id,balance:this.amount(data,address,item.id)}));}
  async grantDevItem(itemId:number,quantity:bigint) {if(quantity<=0n||quantity>1000000n)throw new Error('Invalid grant');await this.mutate((data,owner)=>this.credit(data,owner,itemId,quantity));}
  async transferItem(to:Address,itemId:number,quantity:bigint) {if(!isAddress(to)||/^0x0{40}$/i.test(to)||quantity<=0n)throw new Error('Invalid transfer');await this.mutate((data,owner)=>{this.credit(data,owner,itemId,-quantity);this.credit(data,to,itemId,quantity);});}
  async getItems(tokenId:number) {tokenIdToCoordinate(tokenId);return (this.read().parcels[tokenId]?.items??[]).map(item=>({...item,quantity:BigInt(item.quantity)}));}
  async getPortals(tokenId:number) {tokenIdToCoordinate(tokenId);return this.read().parcels[tokenId]?.portals??[];}
  async placeItem(tokenId:number,item:ItemPlacement) {validateItemPlacement(item);await this.mutate((data,owner)=>{if(!this.owns(tokenId))throw new Error('Only the parcel owner may place items.');const parcel=this.parcel(data,tokenId);if(parcel.items.length>=MAX_WORLD_ITEMS||parcel.nextItemId===0xffffffff)throw new Error('Item capacity reached');this.credit(data,owner,item.itemType,-item.quantity);parcel.items.push({...item,id:++parcel.nextItemId,parcelTokenId:tokenId,depositor:owner,quantity:item.quantity.toString()});});}
  async pickupItem(tokenId:number,id:number) {await this.returnItem(tokenId,id);}
  async evictItem(tokenId:number,id:number) {await this.returnItem(tokenId,id);}
  private async returnItem(tokenId:number,id:number) {await this.mutate((data,owner)=>{const parcel=this.parcel(data,tokenId),index=parcel.items.findIndex(i=>i.id===id);if(index<0)throw new Error('Item no longer exists');const item=parcel.items[index];if(!this.owns(tokenId))throw new Error('Only the current parcel owner may collect attached items.');this.credit(data,owner,item.itemType,BigInt(item.quantity));parcel.items.splice(index,1);});}
  async placePortal(tokenId:number,portal:LocalTransform&{destinationTokenId:number}) {validatePortal(portal);await this.mutate((data)=>{if(!this.owns(tokenId))throw new Error('Only the parcel owner may create portals');const parcel=this.parcel(data,tokenId);if(parcel.portals.length>=MAX_PORTALS||parcel.nextPortalId===0xffffffff)throw new Error('Portal capacity reached');parcel.portals.push({...portal,parcelTokenId:tokenId,id:++parcel.nextPortalId});});}
  async removePortal(tokenId:number,id:number) {await this.mutate(data=>{if(!this.owns(tokenId))throw new Error('Only the parcel owner may remove portals');const parcel=this.parcel(data,tokenId),index=parcel.portals.findIndex(p=>p.id===id);if(index<0)throw new Error('Portal no longer exists');parcel.portals.splice(index,1);});}
  async approveEscrow() {} async isEscrowApproved() {return true;}
  subscribe(listener:()=>void) {this.listeners.add(listener);const onStorage=(e:StorageEvent)=>{if(e.key===EXPERIENCE_KEY||e.key===null)listener();};if(typeof window!=='undefined')window.addEventListener('storage',onStorage);return ()=>{this.listeners.delete(listener);if(typeof window!=='undefined')window.removeEventListener('storage',onStorage);};}
}


