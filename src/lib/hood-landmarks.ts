import * as T from 'three';
import type {Building,Business,Footprint} from './hood-buildings';
export const LANDMARKS:Building[]=[
 {id:'mall',name:'DOODZ PLAZA',kind:'corner',x:110,z:-110,w:42,d:40,height:8,dir:1,color:0xb7a78d},
 {id:'parking',name:'NORTHSIDE PARKING',kind:'home',x:-110,z:-110,w:40,d:40,height:7,dir:1,color:0x9da69e}
];
type Box=(w:number,h:number,d:number,x:number,y:number,z:number,c:number,parent?:T.Object3D)=>T.Mesh;
type Sign=(text:string,x:number,y:number,z:number,w:number,parent?:T.Object3D)=>T.Mesh;
export function buildLandmarks(scene:T.Scene,box:Box,sign:Sign,obstacles:Footprint[],solid:T.Object3D[]){
 const services:{kind:Business;name:string;x:number;z:number;building:Building}[]=[];
 for(const b of LANDMARKS){
  const mall=b.id==='mall',opening=mall?8:12,front=b.z+b.d/2;
  function part(x:number,z:number,w:number,h:number,d:number,c:number,y=h/2,block=false){const mesh=box(w,h,d,b.x+x,y,b.z+z,c);if(block){obstacles.push({x:b.x+x,z:b.z+z,w,d});solid.push(mesh);}return mesh;}
  for(const side of [-1,1]){part(side*b.w/2,0,.5,b.height,b.d,b.color,undefined,true);part(side*(b.w+opening)/4,b.d/2,(b.w-opening)/2,b.height,.5,b.color,undefined,true);}
  part(0,-b.d/2,b.w,b.height,.5,b.color,undefined,true);
  solid.push(part(0,b.d/2,opening,b.height-4.8,.5,b.color,(b.height+4.8)/2));
  solid.push(part(0,0,b.w+.8,.35,b.d+.8,0x475b60,b.height));
  part(0,0,b.w,.12,b.d,mall?0xd5c9af:0x6d7c7c,.015);
  part(0,25,opening,.06,10,0x888f82,.08);
  part(0,b.d/2+.35,b.w-1,1.7,.3,0x25454e,5.85);
  sign(b.name,b.x,5.85,front+.53,b.w-3).scale.y=.25;
  sign(mall?'SHOPS / FOOD / LOUNGE':'FREE PARKING / DRIVE IN',b.x,3.8,front+.31,opening-.6);
  for(const x of [-b.w/2+1,b.w/2-1])part(x,0,.2,.3,b.d-.5,0xddd1ad,.25);
  if(mall){
   // A broad center concourse connects three open shop bays and the rear food court.
   part(0,0,5,.02,36,0x8d9f94,.1);
   const shops:[Business,string,number,number][]=[['corner','PLAZA MART',-12,-5],['weapons','SPORT & RANGE',12,-5],['dealer','MOTOR CLUB',-12,8]];
   for(const [kind,name,x,z]of shops){
    part(x,z-4,12,3.6,.25,0x728783,1.8,true);
    part(x,z,7,1.2,1.4,0x9d805c,.7,true);part(x,z,7.2,.12,1.55,0xe4d8be,1.36);
    sign(name,b.x+x,3.2,b.z+z-3.8,10);
    for(let i=0;i<5;i++)part(x-2.4+i*1.2,z-.25,.7,.45,.6,[0xb98062,0x5c7d85,0xd0b675][i%3],1.65);
    part(x,z+2,3,.025,1.2,0xe3c781,.11);
    services.push({kind,name,x:b.x+x,z:b.z+z+2,building:b});
   }
   sign('FOOD COURT',b.x,3.6,b.z-19.6,15);
   for(const x of [-10,0,10]){part(x,-15,3,.12,2,0xb08d64,1);for(const side of [-1,1])part(x,-15+side*1.5,2,.5,.6,0x718c81,.35,true);}
   for(const z of [-8,5]){part(0,z,2,.5,2,0xa4987b,.3,true);part(0,z,1.7,1.2,1.7,0x74936a,1.1);}
   part(12,9,7,.6,1.5,0x807891,.45,true);part(12,9.7,7,1,.2,0x807891,.95);
   sign('LOUNGE',b.x+12,3,b.z+12,8).rotation.y=Math.PI;
   // Clerestory glazing sits above the sign band rather than covering the lettering.
   for(const x of [-15,-10,10,15])part(x,20.28,3,1,.08,0x698b90,7.3);
  }else{
   for(const side of [-1,1])for(let row=0;row<6;row++){
    const z=-15+row*5;part(side*12,z,9,.025,.1,0xe4d8b8,.1);
    if(row%2===0){part(side*18,z,.5,5,.5,0xc2c6b6,2.5,true);part(side*18,z,.56,.65,.56,0xe0b967,.65);}
   }
   for(const x of [-6,6])part(x,0,.12,.025,35,0xe8c785,.11);
   for(const z of [-13,0,13]){part(0,z,.16,.03,2.4,0xe8c785,.11);part(0,z-.8,1.3,.03,.15,0xe8c785,.11);}
   for(const [x,z,c]of [[-12,-12,0xa56f57],[12,-7,0x6f9295],[-12,8,0xc1a76d]]){part(x,z,2,.7,3.8,c,.75,true);part(x,z,1.6,.65,1.8,0x344f5b,1.4);for(const side of [-1,1])for(const axle of [-1.2,1.2])part(x+side,z+axle,.28,.6,.6,0x29383c,.4);}
   sign('P1 / EXIT',b.x,3.5,b.z-19.7,15);
   for(const side of [-1,1])for(const z of [-12,0,12])part(side*20.3,z,.12,2,6,0x364e59,3.5);
  }
  for(const x of [-9,9])for(const z of [-10,6])part(x,z,3,.08,.8,0xffe3aa,b.height-.3);
 }
 const light=new T.PointLight(0xffedcc,65,35,2);scene.add(light);
 return {services,update(player:T.Vector3){const room=LANDMARKS.find(b=>Math.abs(player.x-b.x)<b.w/2&&Math.abs(player.z-b.z)<b.d/2);light.visible=!!room;if(room)light.position.set(room.x,5,room.z);return room;},dispose(){scene.remove(light);}};
}
