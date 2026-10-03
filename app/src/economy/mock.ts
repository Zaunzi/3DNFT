import {MockInventoryProvider,type Data} from '../items/mockInventory.ts';
import {decodeMockParcel,MOCK_STORAGE_PREFIX,type LocalStorageLike} from '../blockchain/mockParcelState.ts';
import type {ParcelStateStore} from '../blockchain/parcelState.ts';
import {tokenIdToCoordinate} from '../world/coordinates.ts';
import {MAX_OBJECTS,validatePlacement,type ObjectPlacement} from '../objects/model.ts';
import {BUILD_COSTS,replenish,RESOURCE_ITEM,HARVEST_COOLDOWN_MS,type HarvestProvider,type Resource,type ParcelResources} from './model.ts';
export interface EconomyData {schema:1;resources:Record<string,ParcelResources>;builds:Record<string,ReturnType<typeof decodeMockParcel>>}
/** Materials, resource allowances and migrated buildings commit in one inventory-ledger write. */
export class MockEconomy implements ParcelStateStore,HarvestProvider {
 private ledger:MockInventoryProvider;private legacy:LocalStorageLike;private owns:(id:number)=>boolean;private now:()=>number;
 constructor(ledger:MockInventoryProvider,legacy:LocalStorageLike,owns:(id:number)=>boolean,now=Date.now){this.ledger=ledger;this.legacy=legacy;this.owns=owns;this.now=now;}
 private state(data:Data){return data.economy??={schema:1,resources:{},builds:{}};}
 private check(id:number){tokenIdToCoordinate(id);if(!this.owns(id))throw new Error('Only the current parcel owner may harvest or build here.');}
 private readReserve(data:Data,id:number){tokenIdToCoordinate(id);const previous=data.economy?.resources[id],now=this.now();return {wood:replenish(previous?.wood,now),stone:replenish(previous?.stone,now),nextHarvestAt:previous?.nextHarvestAt??0};}
 reserves(id:number){return this.readReserve(this.ledger.read(),id);}
 async harvest(id:number,resource:Resource){if(resource!=='wood'&&resource!=='stone')throw new Error('Invalid resource');let amount=0;
 await this.ledger.mutate((data,owner)=>{this.check(id);const reserves=this.readReserve(data,id),now=this.now();if(now<reserves.nextHarvestAt)throw new Error('Wait a moment before harvesting again.');amount=reserves[resource].available;if(!amount)throw new Error(`${resource} reserve depleted. One unit returns every 30 seconds.`);reserves[resource].available-=amount;reserves.nextHarvestAt=now+HARVEST_COOLDOWN_MS;this.state(data).resources[id]=reserves;this.ledger.credit(data,owner,RESOURCE_ITEM[resource],BigInt(amount));});return amount;}
 private parcel(data:Data,id:bigint){tokenIdToCoordinate(Number(id));const state=this.state(data);return state.builds[String(id)]??=decodeMockParcel(this.legacy.getItem(`${MOCK_STORAGE_PREFIX}${id}`));}
 async getObjects(id:bigint){return this.parcel(this.ledger.read(),id).objects;}
 async addObject(id:bigint,placement:ObjectPlacement){validatePlacement(placement);await this.ledger.mutate((data,owner)=>{this.check(Number(id));const parcel=this.parcel(data,id);if(parcel.objects.length>=MAX_OBJECTS||parcel.nextId===0xffffffff)throw new Error('Parcel object capacity reached');const cost=BUILD_COSTS[placement.objectType];
 for(const resource of ['wood','stone'] as const){const balance=BigInt(data.balances[owner.toLowerCase()]?.[RESOURCE_ITEM[resource]]??'0');if(balance<BigInt(cost[resource]))throw new Error(`Need ${cost.wood} wood + ${cost.stone} stone. Harvest nearby trees and rocks first.`);}
 this.ledger.credit(data,owner,RESOURCE_ITEM.wood,-BigInt(cost.wood));this.ledger.credit(data,owner,RESOURCE_ITEM.stone,-BigInt(cost.stone));parcel.objects.push({...placement,id:++parcel.nextId});});}
 async removeObject(id:bigint,objectId:number){await this.ledger.mutate(data=>{this.check(Number(id));const parcel=this.parcel(data,id),index=parcel.objects.findIndex(o=>o.id===objectId);if(index<0)throw new Error('Object no longer exists');parcel.objects.splice(index,1);});}
 subscribe(listener:(id:bigint)=>void){return this.ledger.subscribe(()=>{for(const id of Object.keys(this.ledger.read().economy?.builds??{}))listener(BigInt(id));});}
}
