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
export function snapStructure(type:number,x:number,z:number,objects: readonly import('./model.ts').PersistentWorldObject[], target?: {id:number;hitY:number}) {
  if(![7,8,9,10,11,13,14,15].includes(type))return null;
  if(type===13){
    const doors=objects.filter(o=>o.objectType===9&&o.y!==undefined);
    const direct=doors.find(o=>o.id===target?.id);
    const nearest=direct??doors.filter(o=>Math.hypot(x-o.x,z-o.z)<=220).sort((a,b)=>Math.hypot(x-a.x,z-a.z)-Math.hypot(x-b.x,z-b.z))[0];
    return nearest?{x:nearest.x,z:nearest.z,y:nearest.y!,rotation:nearest.rotation,distance:0}:null;
  }
  const wall=objects.find(o=>o.id===target?.id&&[8,9,10].includes(o.objectType)&&o.y!==undefined);
  if(wall&&[8,9,10,11].includes(type)){
    const a=wall.rotation/100*Math.PI/180,q=localPoint(x,z,wall.x,wall.z,wall.rotation);
    let px=wall.x,pz=wall.z,y=wall.y!;
    if(type===11){const side=q.z<0?-1:1;px+=side*200*Math.sin(a);pz+=side*200*Math.cos(a);}
    else if(target!.hitY>=wall.y!+280){y+=340;} // Wall + 20cm floor slab: 3.4m storeys.
    else {const side=q.x<0?-1:1;px+=side*400*Math.cos(a);pz-=side*400*Math.sin(a);}
    return {x:Math.round(px),z:Math.round(pz),y,rotation:wall.rotation,distance:0};
  }
  let best: {x:number;z:number;y:number;rotation:number;distance:number}|null=null;
  const offer=(px:number,pz:number,y:number,rotation:number,limit:number)=>{
    const distance=Math.hypot(x-px,z-pz);
    if(distance<=limit && (!best||distance<best.distance))best={x:Math.round(px),z:Math.round(pz),y,rotation:rotation%36000,distance};
  };
  if(type===11){
    // Prefer the roof under the cursor when several storeys overlap in X/Z.
    const roofs=objects.filter(o=>o.objectType===11&&o.y!==undefined);
    const targeted=roofs.find(o=>o.id===target?.id);
    for(const roof of targeted?[targeted]:roofs){
      const a=roof.rotation/100*Math.PI/180;
      for(const [dx,dz] of [[0,-400],[0,400],[-400,0],[400,0]]){
        const px=Math.round(roof.x+dx*Math.cos(a)+dz*Math.sin(a)),pz=Math.round(roof.z-dx*Math.sin(a)+dz*Math.cos(a));
        const occupied=roofs.some(o=>o.y===roof.y&&Math.abs(o.x-px)<400&&Math.abs(o.z-pz)<400);
        if(!occupied)offer(px,pz,roof.y!,roof.rotation,250);
      }
    }
    if(best)return best;
  }
  if(type===15){
    for(const roof of objects.filter(o=>o.objectType===11&&o.y!==undefined)){
      const a=roof.rotation/100*Math.PI/180;
      for(const [dx,dz,r] of [[0,400,0],[0,-400,18000],[400,0,9000],[-400,0,27000]])offer(roof.x+dx*Math.cos(a)+dz*Math.sin(a),roof.z-dx*Math.sin(a)+dz*Math.cos(a),roof.y!+50,roof.rotation+r,250);
    }
    return best;
  }
  for(const foundation of objects.filter(o=>o.objectType===7&&o.y!==undefined)){
    if(type===14){
      const a=foundation.rotation/100*Math.PI/180;
      for(const [dx,dz,r] of [[0,300,0],[0,-300,18000],[300,0,9000],[-300,0,27000]]){
        offer(foundation.x+dx*Math.cos(a)+dz*Math.sin(a),foundation.z-dx*Math.sin(a)+dz*Math.cos(a),foundation.y!-50,foundation.rotation+r,200);
      }
    }else if(type===7){
      // 4m centers join the 4m square footprints exactly; inherit the entire floor plane.
      const a=foundation.rotation/100*Math.PI/180;
      for(const [dx,dz] of [[0,-400],[0,400],[-400,0],[400,0]]){
        const px=Math.round(foundation.x+dx*Math.cos(a)+dz*Math.sin(a));
        const pz=Math.round(foundation.z-dx*Math.sin(a)+dz*Math.cos(a));
        const occupied=objects.some(o=>o.objectType===7&&Math.abs(o.x-px)<400&&Math.abs(o.z-pz)<400);
        if(!occupied)offer(px,pz,foundation.y!,foundation.rotation,250);
      }
    }else if(type===11){
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

/** Four 25cm steps; local -Z is the high end. Matches the rendered solid treads. */
export function stairTop(x:number,z:number,base:number):number|null {
  if(Math.abs(x)>1||Math.abs(z)>1)return null;
  return base+Math.min(4,Math.floor((1-z)/.5)+1)*.25;
}

export function storeyStairTop(x:number,z:number,base:number):number|null {
  if(Math.abs(x)>1||Math.abs(z)>2)return null;
  return base+Math.min(14,Math.floor((2-z)/(4/14))+1)*(3.4/14);
}
