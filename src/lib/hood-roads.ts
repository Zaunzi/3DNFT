import * as T from 'three';
import {ROAD_AXES,ROADS,MAP_SIZE} from './hood-layout';
export function buildRoadNetwork(scene:T.Scene,sign:(text:string,x:number,y:number,z:number,w:number)=>T.Mesh){
 const batches=new Map<number,T.Matrix4[]>(),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
 function box(c:number,x:number,y:number,z:number,w:number,h:number,d:number){matrix.compose(position.set(x,y,z),rotation,scale.set(w,h,d));if(!batches.has(c))batches.set(c,[]);batches.get(c)!.push(matrix.clone());}
 box(0x819a6b,0,-.2,0,MAP_SIZE,.3,MAP_SIZE);
 for(const r of ROADS)box(0x454e56,r.x,0,r.z,r.w,.1,r.d);
 for(const axis of ROAD_AXES){
  for(const side of [-1,1]){box(0xbcb5a2,axis+side*9,.1,0,2,.2,302);box(0xbcb5a2,0,.1,axis+side*9,302,.2,2);}
  for(let a=-148;a<=148;a+=4){if(ROAD_AXES.some(v=>Math.abs(a-v)<12))continue;
   box(0xe2c888,axis,.073,a,.14,.02,2);box(0xe2c888,a,.073,axis,2,.02,.14);
   for(const side of [-1,1]){box(0xd8d6bc,axis+side*6.3,.071,a,.09,.015,3.7);box(0xd8d6bc,a,.071,axis+side*6.3,3.7,.015,.09);}
  }
 }
 // Asphalt intersection caps remove sidewalk strips across all vehicle lanes.
 for(const x of ROAD_AXES)for(const z of ROAD_AXES){
  box(0x454e56,x,.12,z,20,.04,20);
  for(const side of [-1,1])for(let i=0;i<7;i++){box(0xeee2c6,x+side*11,.151,z-4.8+i*1.6,2.1,.02,.65);box(0xeee2c6,x-4.8+i*1.6,.151,z+side*11,.65,.02,2.1);}
  if(Math.abs(x)<145&&Math.abs(z)<145){box(0x354d52,x+11,2.6,z+11,.16,5.2,.16);box(0xf2dba2,x+11,5.2,z+11,1.4,.16,.55);}
 }
 // South-east park: a destination off the driving loop, clear of every road.
 box(0x6e8e68,110,.02,110,48,.08,48);
 box(0xbb9f78,110,.09,110,4,.04,48);box(0xbb9f78,110,.09,110,48,.04,4);
 box(0x617d80,121,.12,121,18,.06,22);
 for(const x of [112.5,129.5])box(0xe6d8b7,x,.16,121,.1,.02,21);
 for(const z of [110.5,121,131.5])box(0xe6d8b7,121,.16,z,17,.02,.1);
 for(const z of [112,130]){box(0x415556,121,1.9,z,.13,3.8,.13);box(0xe8dcc4,121,3.7,z,2.5,1.4,.15);box(0xb47a51,121,3.2,z+(z<121?.6:-.6),.9,.08,1.1);}
 for(const x of [91,101,121,131])for(const z of [91,101]){box(0x786347,x,1.5,z,.4,3,.4);box(0x54774f,x,3.4,z,3.2,2.6,3.2);box(0x7f995f,x,4.8,z,2.3,1.3,2.3);}
 sign('SOUTHSIDE PARK',110,3,87,18).rotation.y=Math.PI;
 for(const [name,x,z]of [['NORTHSIDE',0,-100],['WEST END',-100,0],['EASTSIDE',100,0],['SOUTHSIDE',0,100]] as const){
  // Roadside sign posts, outside the carriageway and sidewalk.
  const sx=x===0?13:x,sz=x===0?z:13;box(0x546158,sx,1.8,sz,.12,3.6,.12);sign(name,sx,3.2,sz,6);
 }
 const geometry=new T.BoxGeometry(),objects:T.InstancedMesh[]=[];
 for(const [color,entries]of batches){const material=new T.MeshStandardMaterial({color,roughness:.9});const mesh=new T.InstancedMesh(geometry,material,entries.length);entries.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=color!==0x454e56&&color!==0x819a6b;mesh.computeBoundingSphere();scene.add(mesh);objects.push(mesh);}
 return {dispose(){for(const mesh of objects){scene.remove(mesh);(mesh.material as T.Material).dispose();}geometry.dispose();}};
}
