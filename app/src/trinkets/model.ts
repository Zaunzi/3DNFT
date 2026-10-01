import { validateTransform, type ItemPlacement } from '../items/model.ts';
import { itemDefinition } from './definitions.ts';
export * from '../items/model.ts';
export function validateItemPlacement(item:ItemPlacement){itemDefinition(item.itemType);validateTransform(item,200);if(item.quantity!==1n)throw new Error('Place one instrument at a time.');}
