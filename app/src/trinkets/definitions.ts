import { TRINKETS } from '../items/trinkets.ts';
import type { ItemDefinition } from '../items/definitions.ts';
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = TRINKETS.map(t=>({...t,description:`${t.kind}. Place one instrument on your parcel; E retrieves it into the current owner's wallet.`,stackable:false,maxStack:1n,worldRenderable:true,placeable:true,collectible:true}));
export function itemDefinition(id:number):ItemDefinition {const value=ITEM_DEFINITIONS.find(t=>t.id===id);if(!value)throw new Error('Unknown trinket');return value;}
