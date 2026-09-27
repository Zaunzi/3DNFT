import { parcelToWorld, tokenIdToCoordinate } from '../world/coordinates.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { EYE_HEIGHT } from '../world/constants.ts';
export interface SpawnObstacle { x:number;z:number;radius:number }
/** Conservative planar footprints avoid standing inside any persistent geometry. Fail closed if full. */
export function findSafeSpawnPosition(tokenId:number,seed:bigint,obstacles:SpawnObstacle[],preferred?:{x:number;z:number}) {
  const origin=parcelToWorld(tokenIdToCoordinate(tokenId));
  const candidates:{x:number;z:number}[]=[];
  if(preferred&&Number.isFinite(preferred.x)&&Number.isFinite(preferred.z)&&preferred.x>=1&&preferred.z>=1&&preferred.x<=63&&preferred.z<=63)candidates.push(preferred);
  candidates.push({x:32,z:32});
  for(let ring=1;ring<=31;ring++)for(let z=-ring;z<=ring;z++)for(let x=-ring;x<=ring;x++)if(Math.max(Math.abs(x),Math.abs(z))===ring)candidates.push({x:32+x,z:32+z});
  for(const candidate of candidates) {
    const x=origin.x+candidate.x,z=origin.z+candidate.z;
    if(obstacles.every(o=>Math.hypot(x-o.x,z-o.z)>o.radius+.6))return {x,y:getGroundHeight(x,z,seed)+EYE_HEIGHT,z};
  }
  throw new Error('Destination is obstructed. Travel cancelled; you remain at the source.');
}
