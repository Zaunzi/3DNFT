import * as T from 'three';
import type {Footprint} from './hood-buildings';
export const TRAFFIC_LOOPS=[{left:-69,right:69,top:-69,bottom:69},{left:75,right:141,top:-69,bottom:69}];
export function trafficPose(distance:number,loop:typeof TRAFFIC_LOOPS[number]){
 const w=loop.right-loop.left,h=loop.bottom-loop.top,length=2*(w+h);let t=((distance%length)+length)%length;
 if(t<w)return{x:loop.left+t,z:loop.top,dx:1,dz:0};t-=w;
 if(t<h)return{x:loop.right,z:loop.top+t,dx:0,dz:1};t-=h;
 if(t<w)return{x:loop.right-t,z:loop.bottom,dx:-1,dz:0};t-=w;
 return{x:loop.left,z:loop.bottom-t,dx:0,dz:-1};
}
export function trafficBlocked(p:{x:number;z:number;dx:number;dz:number},blockers:readonly {x:number;z:number}[]){return blockers.some(b=>{const dx=b.x-p.x,dz=b.z-p.z;return Math.hypot(dx,dz)<7&&Math.abs(dx*p.dz-dz*p.dx)<3.3&&dx*p.dx+dz*p.dz>-.5;});}
export function addTraffic(carModel:(color:number)=>T.Group,obstacles:Footprint[],solid:T.Object3D[]){
 const cars=Array.from({length:7},(_,i)=>{const loop=TRAFFIC_LOOPS[i<3?0:1],length=2*(loop.right-loop.left+loop.bottom-loop.top),distance=(i<3?i/3:(i-3)/4)*length;
  const model=carModel([0xc6ae79,0x799699,0xa27567,0x707d91,0xc8c7b4,0x947c98,0x6c8b72][i]),bounds={x:0,z:0,w:2.2,d:4.1};obstacles.push(bounds);model.traverse(o=>{if(o instanceof T.Mesh)solid.push(o);});return{loop,distance,model,bounds};
 });
 function sync(){for(const c of cars){const p=trafficPose(c.distance,c.loop);c.model.position.set(p.x,.08,p.z);c.model.rotation.y=Math.atan2(p.dx,p.dz);Object.assign(c.bounds,{x:p.x,z:p.z,w:p.dx?4.1:2.2,d:p.dx?2.2:4.1});}}
 sync();
 return {update(dt:number,player:T.Vector3,playerCar:T.Vector3){const positions=cars.map(c=>({x:c.bounds.x,z:c.bounds.z}));for(const [i,c]of cars.entries()){const p=trafficPose(c.distance,c.loop);if(!trafficBlocked(p,[player,playerCar,...positions.filter((_,j)=>j!==i)]))c.distance+=dt*6;}sync();},dispose(){for(const c of cars){c.model.removeFromParent();const i=obstacles.indexOf(c.bounds);if(i>=0)obstacles.splice(i,1);c.model.traverse(o=>{const index=solid.indexOf(o);if(index>=0)solid.splice(index,1);});}}};
}
