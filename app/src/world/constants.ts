export const WORLD_WIDTH = 100;
export const WORLD_DEPTH = 50;
export const MAX_SUPPLY = WORLD_WIDTH * WORLD_DEPTH;
export const PARCEL_SIZE = 64;
export const SEGMENTS = 32;
export const CELL_SIZE = PARCEL_SIZE / SEGMENTS;
export const LOAD_RADIUS = 2;
export const GENERATOR_VERSION = 1;
export const DEFAULT_SEED = 7422026n;
export const EYE_HEIGHT = 1.75;
export const WALK_SPEED = 8;
export const SPRINT_SPEED = 22;

export const JUMP_SPEED = 7;
export const GRAVITY = 20;

// Terrain tuning revision 2: gentler relief; global sampling and topology are unchanged.
export const TERRAIN_AMPLITUDES = { broad: 16, rolling: 3.5, detail: 0.6 } as const;
