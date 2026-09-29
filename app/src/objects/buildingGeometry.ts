import * as THREE from 'three';
import type { WorldObjectType } from './model.ts';
/** Shared templates are disposed once by ObjectRegistry, never by streamed clones. */
export function buildingTemplates(): Map<WorldObjectType,THREE.Group> {
 const result=new Map<WorldObjectType,THREE.Group>();
 const wood=new THREE.MeshStandardMaterial({color:0x8f694a,roughness:.9});
 const plaster=new THREE.MeshStandardMaterial({color:0xbeb8a0,roughness:1});
 const stone=new THREE.MeshStandardMaterial({color:0x6c736b,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x3d493f,roughness:.8});
 const metal=new THREE.MeshStandardMaterial({color:0x423b2e,metalness:.65,roughness:.4});
 const glow=new THREE.MeshStandardMaterial({color:0xffca69,emissive:0xffa52c,emissiveIntensity:2});
 const box=(g:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);};
 for(const type of [7,8,9,10,11,12,14] as const){const g=new THREE.Group();result.set(type,g);
  if(type===7){box(g,4,.92,4,0,-.04,0,stone);for(let i=0;i<8;i++)box(g,.49,.08,4,-1.75+i*.5,.46,0,wood);}
  if(type===8||type===9||type===10){
   if(type===8)box(g,4,3.2,.24,0,2.1,0,plaster);
   if(type===9){for(const x of [-1.55,1.55])box(g,.9,3.2,.24,x,2.1,0,plaster);box(g,2.2,.3,.24,0,3.55,0,plaster);}
   if(type===10){for(const x of [-1.5,1.5])box(g,1,3.2,.24,x,2.1,0,plaster);box(g,2,1.1,.24,0,1.05,0,plaster);box(g,2,.6,.24,0,3.4,0,plaster);box(g,.07,1.5,.25,0,2.35,0,wood);box(g,2,.07,.25,0,2.35,0,wood);}
   for(const x of [-1.91,1.91])box(g,.18,3.2,.3,x,2.1,0,wood);box(g,4,.15,.3,0,3.62,0,wood);
  }
  if(type===11){box(g,4,.2,4,0,3.8,0,dark);for(let i=0;i<8;i++)box(g,4,.04,.035,0,3.92,-1.75+i*.5,stone);}
  if(type===14){for(let i=0;i<4;i++){const h=(i+1)*.25,z=.75-i*.5;box(g,2,h-.04,.5,0,(h-.04)/2,z,stone);box(g,2,.04,.5,0,h-.02,z,wood);}}
  if(type===12){box(g,.55,.12,.55,0,.06,0,stone);box(g,.10,1.9,.10,0,1,0,metal);box(g,.48,.09,.48,0,1.75,0,metal);box(g,.32,.5,.32,0,2.02,0,glow);box(g,.55,.1,.55,0,2.32,0,metal);for(const x of [-.21,.21])for(const z of [-.21,.21])box(g,.045,.6,.045,x,2.02,z,metal);}
 }
 return result;
}
