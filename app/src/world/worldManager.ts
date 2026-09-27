import type { Scene } from 'three';
import { LOAD_RADIUS } from './constants.ts';
import { nearbyTokenIds, tokenIdToCoordinate } from './coordinates.ts';
import { createParcel, type ParcelView } from './parcel.ts';
export class WorldManager {
  readonly parcels = new Map<number, ParcelView>();
  private current = -1;
  borders = true;
  private scene: Scene;
  readonly seed: bigint;
  constructor(scene: Scene, seed: bigint) { this.scene = scene; this.seed = seed; }
  update(tokenId: number) {
    if (tokenId === this.current) return;
    this.current = tokenId;
    const wanted = new Set(nearbyTokenIds(tokenIdToCoordinate(tokenId), LOAD_RADIUS));
    for (const [id, parcel] of this.parcels) if (!wanted.has(id)) { parcel.dispose(); this.parcels.delete(id); }
    for (const id of wanted) if (!this.parcels.has(id)) { const parcel = createParcel(id, this.seed); parcel.border.visible = this.borders; this.scene.add(parcel.group); this.parcels.set(id, parcel); }
  }
  setBorders(visible: boolean) { this.borders = visible; for (const p of this.parcels.values()) p.border.visible = visible; }
  dispose() { for (const p of this.parcels.values()) p.dispose(); this.parcels.clear(); }
}
