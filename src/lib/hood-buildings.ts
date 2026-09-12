import * as T from 'three';
import {HOME_LOTS,DOWNTOWN_LOTS} from './hood-layout.ts';

export type Business='police'|'corner'|'weapons'|'repair'|'dealer';
export type Footprint={x:number;z:number;w:number;d:number};
export type Building=Footprint&{id:string;name:string;kind:Business|'home';color:number;dir:number;height:number};
export const BUILDINGS:Building[]=[
 {id:'police',kind:'police',name:'DOODZ POLICE',x:-23,z:-22,w:18,d:14,color:0x568cb4,dir:1,height:8},
 {id:'corner',kind:'corner',name:'CORNER MART',x:23,z:-22,w:18,d:14,color:0xe5a54f,dir:1,height:8},
 {id:'weapons',kind:'weapons',name:'BLOCK ARMS',x:-23,z:23,w:18,d:14,color:0xbb6658,dir:-1,height:8},
 {id:'repair',kind:'repair',name:'REPAIR & TUNE',x:23,z:23,w:18,d:14,color:0x66a98c,dir:-1,height:8},
 {id:'dealer',kind:'dealer',name:'DOODZ MOTORS',x:46,z:-23,w:15,d:16,color:0xa085c1,dir:1,height:8},
 ...HOME_LOTS.map(([x,z],i)=>({id:`home-${i+1}`,kind:'home' as const,name:`BLOCK HOUSE ${i+1}`,x,z,w:14,d:13,color:[0xa68e77,0x8f9b88,0x9c8682][i%3],dir:1,height:12})),
 ...DOWNTOWN_LOTS.map(([x,z],i)=>({id:`downtown-${i+1}`,kind:(i===0?'corner':i===4?'weapons':'home') as Business|'home',name:['METRO MARKET','GRAND HOUSE','SKYLINE COURT','THE EXCHANGE','CITY SPORTS','CENTRAL HOUSE','PARK AVENUE','EAST TOWER'][i],x,z,w:14,d:14,color:[0x879c9b,0xa39d8f,0x758b98][i%3],dir:z<0?1:-1,height:i===0||i===4?8:24+i%4*3}))
];
export const entrance=(b:Building)=>({x:b.x,z:b.z+b.dir*b.d/2});
export function wallPlan(b:Building){
 const front=entrance(b).z,wing=(b.w-3.2)/2;
 return [
  {x:b.x-b.w/2,z:b.z,w:.45,d:b.d},
  {x:b.x+b.w/2,z:b.z,w:.45,d:b.d},
  {x:b.x,z:b.z-b.dir*b.d/2,w:b.w,d:.45},
  {x:b.x-(3.2+wing)/2,z:front,w:wing,d:.45},
  {x:b.x+(3.2+wing)/2,z:front,w:wing,d:.45}
 ];
}
type Box=(w:number,h:number,d:number,x:number,y:number,z:number,c:number,parent?:T.Object3D)=>T.Mesh;
type Sign=(text:string,x:number,y:number,z:number,w:number,parent?:T.Object3D)=>T.Mesh;
export function buildNeighborhood(scene:T.Scene,box:Box,sign:Sign,obstacles:Footprint[],solid:T.Object3D[]){
 const services:{kind:Business;name:string;x:number;z:number;building:Building}[]=[];
 const interiorGroups:{building:Building;group:T.Group}[]=[];
 for(const b of BUILDINGS){
  const front=entrance(b).z,dir=b.dir;
  const collidable=(w:number,h:number,d:number,x:number,y:number,z:number,c:number,parent?:T.Object3D)=>{
   const mesh=box(w,h,d,x,y,z,c,parent);solid.push(mesh);obstacles.push({x,z,w,d});return mesh;
  };
  for(const wall of wallPlan(b))collidable(wall.w,b.height,wall.d,wall.x,b.height/2,wall.z,b.color);
  // Full-height shells have a real 3.2 m wide opening; overhead pieces never block feet.
  solid.push(box(3.2,b.height-3.8,.45,b.x,(b.height+3.8)/2,front,b.color));
  solid.push(box(b.w+.6,.35,b.d+.6,b.x,b.height,b.z,0x34444a));
  solid.push(box(b.w-.5,.18,b.d-.5,b.x,4.65,b.z,0xd5cbb8));
  box(b.w-.5,.10,b.d-.5,b.x,.025,b.z,b.kind==='repair'?0x798581:b.kind==='home'?0xb49872:0xc9c4b2);
  // Threshold stays level with the street; open door leaves sit against the inside jambs.
  box(3.1,.035,1,b.x,.08,front,0xd9cbb0);
  for(const dx of [-1.7,1.7])box(.16,3.9,.65,b.x+dx,1.95,front,0xe5d7b6);
  box(3.5,.16,.65,b.x,3.88,front,0xe5d7b6);
  for(const dx of [-1.48,1.48])box(.08,3.5,1.35,b.x+dx,1.8,front-dir*.75,0x35555d);
  sign(b.kind==='home'?'OPEN LOBBY':'WALK IN',b.x,3.45,front+dir*.27,2.5).rotation.y=dir===1?0:Math.PI;
  sign(b.name,b.x,b.kind==='home'?4.7:6.3,front+dir*.40,b.kind==='home'?8:b.w-1).rotation.y=dir===1?0:Math.PI;
  for(const dx of [-b.w*.32,b.w*.32]){
   box(3.2,2.25,.10,b.x+dx,2.35,front+dir*.25,0x38545c);
   box(3.5,.14,.4,b.x+dx,1.15,front+dir*.25,0xe0cfa9);
  }
  // Each ground floor is furnished; upper apartment floors remain an exterior facade.
  if(b.kind==='home'){
   for(let floor=1;floor<(b.id.startsWith('downtown')?Math.floor((b.height-3)/3):3);floor++)for(const dx of [-4,0,4])box(2,2,.12,b.x+dx,3.7+floor*3,front+dir*.25,0x3d5660);
   box(b.w+4,.08,5,b.x,.08,front+dir*2.5,0xb6ad97);
   for(const dx of [-4.9,4.9]){box(1.3,.65,1.3,b.x+dx,.4,front+dir*1.3,0x827d6c);box(1.15,.6,1.15,b.x+dx,.95,front+dir*1.3,0x71875a);}
  }else box(b.w,.22,2.7,b.x,4.6,front+dir*1.2,b.color);
  const group=new T.Group();scene.add(group);interiorGroups.push({building:b,group});
  function prop(x:number,z:number,w:number,h:number,d:number,color:number,y=h/2+.1,collision=false){return collision?collidable(w,h,d,b.x+x,y,b.z+dir*z,color,group):box(w,h,d,b.x+x,y,b.z+dir*z,color,group)}
  function label(text:string,x:number,z:number,w:number,y=2.8){const mesh=sign(text,b.x+x,y,b.z+dir*z,w,group);mesh.rotation.y=dir===1?0:Math.PI;return mesh}
  // Long center aisle connects the street, seating and service area.
  for(const x of [-b.w/2+.35,b.w/2-.35])prop(x,0,.12,.22,b.d-.6,0x5c6f69,.25);
  for(const x of [-3.7,3.7])for(const z of [-3,2]){
   const lamp=prop(x,z,1.8,.06,.8,0xffe7b3,4.49);
   const material=new T.MeshStandardMaterial({color:0xffefd0,emissive:0xffd9a0,emissiveIntensity:.8});lamp.material=material;
  }
  function sofa(x:number,z:number,color:number){prop(x,z,2.8,.65,1.15,color,.48,true);prop(x,z-.5,2.8,.9,.22,color,1);for(const dx of [-1.3,1.3])prop(x+dx,z,.18,.7,1.2,color,.8)}
  function desk(x:number,z:number,color=0x8f7051){prop(x,z,3.4,1.2,1.15,color,.7,true);prop(x,z,3.6,.12,1.3,0xd5c5a7,1.35);prop(x+.65,z,.65,.45,.10,0x294650,1.65)}
  function shelf(x:number,z:number){prop(x,z,1.2,2.4,3.5,0x646f61,1.3,true);for(let row=0;row<3;row++)for(let j=0;j<6;j++)prop(x+.63,z-1.3+j*.5,.22,.40,.3,[0xce9a58,0xb66a57,0x80a58b][(j+row)%3],.65+row*.65)}
  if(b.kind!=='home'){
   desk(4,-2,b.kind==='police'?0x4b6a7e:0x8d7357);
   services.push({kind:b.kind,name:b.name,x:b.x+4,z:b.z+dir*.1,building:b});
   prop(4,.1,2,.035,1.1,0xdac085,.12);label(b.kind==='police'?'DISPATCH / JOBS':'SERVICE / E',4,-2.65,3.1,2.35);
   label('EXIT',0,b.d/2-.4,2.1,3.35).rotation.y=dir===1?Math.PI:0;
  }
  if(b.kind==='corner'){
   shelf(-5,-1);shelf(-2.8,-1);
   for(let i=0;i<3;i++){prop(-5+i*2,-5.9,1.7,2.8,.7,0xd8d6bc,1.5,true);prop(-5+i*2,-5.48,1.4,2.2,.06,0x648b8a,1.55)}
   label('COLD DRINKS',-3,-5.42,5,3.4);label('FRESH / LOCAL',-5,4.5,3,3.2);
   prop(6,3,1.4,1.1,1.3,0x9a7651,.65,true);for(let i=0;i<4;i++)prop(5.55+i*.3,3,.25,.25,.6,0xbb6750,1.35);
  }else if(b.kind==='police'){
   sofa(-5,3,0x466577);sofa(-5,.7,0x466577);
   prop(-4,-3,5,.12,1.2,0x728481,1.2,true);
   for(const x of [-5.5,-2.5]){prop(x,-3,.9,.65,.15,0x254453,1.6);prop(x,-2,1,.65,.8,0x466577,.5,true)}
   prop(5,-5.4,4.5,2.6,.7,0x5c6f75,1.4,true);
   for(let i=0;i<5;i++)prop(3+i,-4.98,.035,2.4,.06,0xadb4a9,1.4);
   label('COMMUNITY DESK',-4,-6.5,6,3.25);label('DOODZ PD',0,-6.5,2.4,4);
  }else if(b.kind==='weapons'){
   prop(-4,-5.7,6,2.7,.4,0x344b51,1.8,true);
   for(let row=0;row<2;row++)for(let i=0;i<3;i++){prop(-6+i*1.8,-5.4,1.25,.15,.16,0x8d9b94,1.2+row);prop(-6.2+i*1.8,-5.4,.14,.42,.16,0x53615c,1.0+row)}
   prop(-4,0,5,1.1,1.7,0x648b8c,.7,true);prop(-4,0,5.1,.09,1.8,0xa5beb4,1.3);
   label('RANGE / SPORT',-4,-5.39,5.5,3.6);
   for(let i=0;i<3;i++)prop(-6+i*1.7,3,1.4,.9,1.2,0x827552,.55,true);
  }else if(b.kind==='repair'){
   prop(-4,-1,3.2,.15,5.5,0x4f686c,.2);for(const x of [-6,-2])prop(x,-1,.35,3.5,.5,0xc49b4f,1.85,true);
   prop(-4,-1,1.9,.7,3.8,0xb56d4c,1.25,true);prop(-4,-1,1.5,.6,1.8,0x385661,1.9);
   prop(-4,-5.8,5.2,1.4,.8,0x984e46,.8,true);
   for(let i=0;i<6;i++)prop(-6+i*.8,-5.34,.6,.12,.04,0xd4c8a4,1.05);
   label('SERVICE BAY 01',-4,-5.25,5.8,3.5);label('TOOLS',4,-6.5,3,3.2);
  }else if(b.kind==='dealer'){
   prop(-3.7,-1,4,.13,6.5,0x59716e,.2);
   prop(-3.7,-1,1.9,.7,3.8,0xe2bc69,.75,true);prop(-3.7,-1,1.5,.65,1.8,0x3b606e,1.35);prop(-3.7,-1,1.7,.12,1.9,0xe2bc69,1.75);
   for(const x of [-4.7,-2.7])for(const z of [-2.1,.1])prop(x,z,.25,.6,.65,0x26383c,.45);
   sofa(3.8,4.8,0x876b78);label('FIND YOUR NEXT RIDE',0,-7.4,11,3.3);
  }else{
   sofa(-4,2,[0x6a8a7b,0x977967,0x777f9b][Number(b.id.slice(-1))%3]);
   prop(-4,.1,2,.5,1,0x927555,.35,true);prop(-4,-2,3,.6,.55,0x6e6759,.4,true);prop(-4,-2,2.3,1.3,.10,0x29434d,1.5);
   for(let i=0;i<3;i++){prop(4,-4+i*1.6,1.7,1,1.5,0xc1b395,.6,true);prop(4,-4+i*1.6,1.8,.08,1.6,0xe3d6b7,1.16)}
   prop(5,-5,1.3,2.5,1.2,0xc9cec0,1.35,true);prop(3.7,2.4,2,.12,2,0x9a7a55,.95,true);
   prop(-4,-4.8,2.3,.6,2,0x849888,.4,true);prop(-4,-5.4,2,.18,.55,0xe8dac0,.8);
   label('WELCOME HOME',0,-6.15,5,3.1);label('MAIL / RESIDENTS',4,5.9,3,2.5).rotation.y=Math.PI;
  }
 }
 // Only the current room needs dynamic light; nearby daylight still comes from the hemisphere.
 const lights=[new T.PointLight(0xffe3b7,24,18,2),new T.PointLight(0xe0edff,16,15,2)];lights.forEach(l=>scene.add(l));
 return {services,update(player:T.Vector3){const current=BUILDINGS.find(b=>Math.abs(player.x-b.x)<b.w/2&&Math.abs(player.z-b.z)<b.d/2);lights.forEach((l,i)=>{l.visible=!!current;if(current)l.position.set(current.x+(i?3:-3),3.6,current.z)});for(const {building,group}of interiorGroups)group.visible=Math.hypot(player.x-building.x,player.z-building.z)<38;return current},dispose(){lights.forEach(l=>scene.remove(l));for(const {group}of interiorGroups){group.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&o.material.emissiveIntensity===.8)o.material.dispose()});scene.remove(group)}}};
}
