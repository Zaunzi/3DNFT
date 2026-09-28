import { getGroundHeight } from '../world/terrain.ts';
import { objectToWorldPosition, type ObjectPlacement } from './model.ts';
export const BUILD_GRID = 50; // centimeters; 4 m modules and 2 m half-widths share this grid.
export function snapBuildCoordinate(value: number) { return Math.round(value / BUILD_GRID) * BUILD_GRID; }
export function objectBaseY(token: number, object: ObjectPlacement, seed: bigint) {
  const p = objectToWorldPosition(token, object);
  return object.y === undefined ? getGroundHeight(p.x, p.z, seed) : object.y / 100;
}
export function localPoint(x:number,z:number,centerX:number,centerZ:number,rotation:number) {
  const a=rotation/100*Math.PI/180,dx=x-centerX,dz=z-centerZ;
  return {x:dx*Math.cos(a)-dz*Math.sin(a),z:dx*Math.sin(a)+dz*Math.cos(a)};
}
export function structureBlocks(type:number,x:number,z:number,feet:number,base:number) {
  const r=.28;
  if(feet+1.65<base || feet>base+3.7)return false;
  if(type===8)return Math.abs(x)<2+r&&Math.abs(z)<.15+r;
  if(type===9)return Math.abs(x)<2+r&&Math.abs(x)>1.1-r&&Math.abs(z)<.15+r;
  if(type===10)return Math.abs(x)<2+r&&Math.abs(z)<.15+r;
  return false;
}
