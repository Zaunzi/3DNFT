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

/** Structural snapping uses saved transforms, so every client derives the same joints. */
export function snapStructure(type:number,x:number,z:number,objects: readonly import('./model.ts').PersistentWorldObject[]) {
  if(![8,9,10,11].includes(type))return null;
  let best: {x:number;z:number;y:number;rotation:number;distance:number}|null=null;
  const offer=(px:number,pz:number,y:number,rotation:number,limit:number)=>{
    const distance=Math.hypot(x-px,z-pz);
    if(distance<=limit && (!best||distance<best.distance))best={x:Math.round(px),z:Math.round(pz),y,rotation:rotation%36000,distance};
  };
  for(const foundation of objects.filter(o=>o.objectType===7&&o.y!==undefined)){
    if(type===11){
      // A roof centers over the foundation only once a wall occupies one of its edges.
      const supported=objects.some(w=>[8,9,10].includes(w.objectType)&&w.y===foundation.y&&Math.abs(Math.hypot(w.x-foundation.x,w.z-foundation.z)-200)<1);
      if(supported)offer(foundation.x,foundation.z,foundation.y!,foundation.rotation,300);
    }else{
      const a=foundation.rotation/100*Math.PI/180;
      for(const [dx,dz,r] of [[0,-200,0],[0,200,0],[-200,0,9000],[200,0,9000]]){
        offer(foundation.x+dx*Math.cos(a)+dz*Math.sin(a),foundation.z-dx*Math.sin(a)+dz*Math.cos(a),foundation.y!,foundation.rotation+r,220);
      }
    }
  }
  // Standalone wall runs also support roofs. Pick the side nearest the cursor.
  if(type===11&&!best)for(const wall of objects.filter(o=>[8,9,10].includes(o.objectType)&&o.y!==undefined)){
    const a=wall.rotation/100*Math.PI/180;
    for(const side of [-1,1])offer(wall.x+side*200*Math.sin(a),wall.z+side*200*Math.cos(a),wall.y!,wall.rotation,250);
  }
  return best as {x:number;z:number;y:number;rotation:number;distance:number}|null;
}
