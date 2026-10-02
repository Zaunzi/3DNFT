import type {WorldObjectType} from '../objects/model.ts';
export type Resource='wood'|'stone';
export const RESERVE_CAP=40, HARVEST_YIELD=4, REFILL_MS=30000, HARVEST_COOLDOWN_MS=2000;
export const RESOURCE_ITEM={wood:2,stone:1} as const;
export interface Reserve {available:number;updatedAt:number}
export interface ParcelResources {wood:Reserve;stone:Reserve;nextHarvestAt:number}
export interface HarvestProvider { reserves(parcel:number):ParcelResources;harvest(parcel:number,resource:Resource):Promise<number> }
export function replenish(reserve:Reserve|undefined,now:number):Reserve {
 if(!reserve)return {available:RESERVE_CAP,updatedAt:now};
 const elapsed=Math.max(0,now-reserve.updatedAt),units=Math.floor(elapsed/REFILL_MS);
 const available=Math.min(RESERVE_CAP,reserve.available+units);
 return {available,updatedAt:available===RESERVE_CAP?Math.max(now,reserve.updatedAt):reserve.updatedAt+units*REFILL_MS};
}
export const BUILD_COSTS:Record<WorldObjectType,{wood:number;stone:number}>={
 1:{wood:2,stone:2},2:{wood:6,stone:2},3:{wood:0,stone:4},4:{wood:4,stone:0},5:{wood:0,stone:4},
 7:{wood:8,stone:4},8:{wood:4,stone:2},9:{wood:4,stone:2},10:{wood:4,stone:2},11:{wood:6,stone:2},12:{wood:2,stone:2},14:{wood:4,stone:2},15:{wood:8,stone:4}
};
export function costLabel(type:number){const cost=BUILD_COSTS[type as WorldObjectType];return cost?`${cost.wood} wood + ${cost.stone} stone`:'No material cost in this prototype';}
