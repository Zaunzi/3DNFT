export interface ItemDefinition {
  id: number; name: string; description: string; stackable: boolean; maxStack: bigint;
  worldRenderable: boolean; placeable: boolean; collectible: boolean;
}
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  { id: 1, name: 'Stone', description: 'A stack of stone.', stackable: true, maxStack: 1000000n, worldRenderable: true, placeable: true, collectible: true },
  { id: 2, name: 'Wood', description: 'A bundle of wood.', stackable: true, maxStack: 1000000n, worldRenderable: true, placeable: true, collectible: true },
  { id: 3, name: 'Crystal', description: 'A luminous crystal.', stackable: true, maxStack: 1000000n, worldRenderable: true, placeable: true, collectible: true },
  { id: 4, name: 'Key', description: 'Opens doors configured to check this wallet-held key. CHECK_ONLY locks do not consume it.', stackable: false, maxStack: 1n, worldRenderable: true, placeable: true, collectible: true },
  { id: 5, name: 'Lantern', description: 'Use to toggle your local exploration light.', stackable: false, maxStack: 1n, worldRenderable: true, placeable: true, collectible: true },
  { id: 6, name: 'Portal Core', description: 'A dormant artifact. Portal building does not consume it in this phase.', stackable: false, maxStack: 1n, worldRenderable: true, placeable: true, collectible: true },
];
export function itemDefinition(id: number): ItemDefinition {
  const definition = ITEM_DEFINITIONS.find(item => item.id === id);
  if (!definition) throw new Error('Unknown item type'); return definition;
}
