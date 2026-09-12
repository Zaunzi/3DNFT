import * as T from 'three';
import {HOME_LOTS} from './hood-layout';
type Place=readonly[string,string,number,number,number];
/** Static decoration is batched by material; no extra draw call per brick, stripe or planter. */
export function dressNeighborhood(scene:T.Scene,places:readonly Place[]){
 const batches=new Map<number,T.Matrix4[]>(),objects:T.Object3D[]=[],resources:(T.Material|T.BufferGeometry|T.Texture)[]=[];const matrix=new T.Matrix4(),pos=new T.Vector3(),scale=new T.Vector3(),q=new T.Quaternion();
 function box(c:number,x:number,y:number,z:number,w:number,h:number,d:number,angle=0){pos.set(x,y,z);scale.set(w,h,d);q.setFromAxisAngle(new T.Vector3(0,1,0),angle);matrix.compose(pos,q,scale);if(!batches.has(c))batches.set(c,[]);batches.get(c)!.push(matrix.clone())}
 const pavement=0xc8bc9f,curb=0xe3d4b2;
 for(const [kind,_name,x,z]of places){const w=kind==='dealer'?15:18,d=kind==='dealer'?16:14,dir=z<0?1:-1,front=z+dir*d/2;
  for(const side of [-1,1]){box(pavement,x,.10,z+side*(d/2+1.5),w+6,.2,3);box(pavement,x+side*(w/2+1.5),.10,z,3,.2,d);}
  // Shop-front paving, kerb and inset tile seams.
  box(curb,x,.13,front+dir*3,w+6,.25,.23);
  for(let px=x-w/2-2;px<x+w/2+3;px+=2)box(0xabaa97,px,.215,front+dir*1.5,.025,.012,2.8);
  for(let row=0;row<5;row++)for(let j=0;j<12;j++){const px=x-w/2+.5+j*(w-1)/11+(row%2?.17:0);if(Math.abs(px-x)<1.95)continue;box(row%2?0x777269:0x948777,px,.35+row*.19,front+dir*.12,(w-1)/12-.045,.13,.08)}
  for(const dx of [-w/2+.3,w/2-.3])box(0xe7d3ad,x+dx,4,front+dir*.15,.44,7.6,.32);
  box(0xd5c4a4,x,5.1,front+dir*.20,w,.18,.32);
  // Real window frames, lower display plinths and warm window accents.
  for(const dx of [-6,6]){box(0xb6c9c7,x+dx,3.25,front+dir*.16,.07,2.9,.1);box(0xc2d6cf,x+dx,3.8,front+dir*.17,3.4,.045,.1);box(0xcbb48a,x+dx,1.7,front+dir*.22,3.5,.18,.35)}
  for(let i=0;i<12;i++)box(i%2?0xf2d7a3:kind==='corner'?0xb86049:0x526c72,x-w/2+(i+.5)*w/12,4.61,front+dir*1.2,w/12-.02,.26,2.7);
  box(0xf7d292,x,4.35,front+dir*2.4,w-.4,.075,.1);
  box(0x4d5756,x-w*.27,8.65,z,2.2,1.0,2);box(0x78857c,x-w*.27,9.17,z,2.5,.16,2.25);
  for(let j=0;j<6;j++)box(0x323e42,x-w*.27-.9+j*.36,9.27,z,.08,.05,1.7);
  box(0x36454a,x+w*.3,9.2,z,.09,2.4,.09);box(0x36454a,x+w*.3,10.2,z,1.5,.07,.07);
  if(kind==='corner'){for(let i=0;i<3;i++){box(0x876647,x-6+i*1.2,.55,front+dir*1.7,1,.8,.75);for(let j=0;j<3;j++)box([0xd19145,0x749356,0xbd5748][i],x-6+i*1.2+(j-1)*.26,1.02,front+dir*1.7,.23,.24,.5)}box(0x9c433d,x+8,1.1,front+dir*1.8,1.2,2,.9);box(0x273e48,x+8,1.3,front+dir*2.27,.9,1.35,.06)}
  if(kind==='repair'){box(0x536065,x+5,2.2,front+dir*.2,5,3.6,.15);for(let y=.7;y<4;y+=.35)box(0x788b8b,x+5,y,front+dir*.3,4.9,.06,.06);for(const px of [x-8,x+8]){box(0x262f32,px,.8,front+dir*2, .85,1.4,.85);for(let k=0;k<4;k++)box(0x414a49,px,.3+k*.35,front+dir*2,.95,.10,.95)}}
  if(kind==='police'){box(0xd4c9a4,x+7,10,z-3,.07,4,.07);box(0x567899,x+7.7,11.2,z-3,1.4,.9,.06);for(const dx of [-3.5,3.5]){box(0x353f46,x+dx,.75,front+dir*2.5,.22,1.2,.22);box(0xd5bc78,x+dx,1.35,front+dir*2.5,.28,.10,.28)}}
  if(kind==='dealer'){for(let i=0;i<9;i++)box([0xf0bf66,0xb66355,0x7da2a5][i%3],x-6+i*1.5,6.8,front+dir*1.5,.8,.42,.05);box(0x203b48,x,3.0,front+dir*.18,2,1.2,.1)}
 }
 // Four zebra crossings and lane-edge paint make the intersection read like a street.
 for(const sign of [-1,1])for(let i=0;i<8;i++){box(0xf0e4c8,sign*10,.077,-5.4+i*1.55,3,.025,.65);box(0xf0e4c8,-5.4+i*1.55,.078,sign*10,.65,.025,3)}
 for(let a=-64;a<67;a+=4){if(Math.abs(a)>14){for(const x of [-6.3,6.3])box(0xb4b3a4,x,.071,a,.10,.018,3.2);for(const z of [-6.3,6.3])box(0xb4b3a4,a,.071,z,3.2,.018,.10)}}
 function bench(x:number,z:number){for(let i=0;i<4;i++){box(0x8d6748,x, .65,z+(i-1.5)*.14,2,.12,.11);box(0x8d6748,x,.96+i*.14,z+.25,2,.1,.1)}for(const dx of [-.7,.7])box(0x364648,x+dx,.34,z,.1,.6,.55);}
 for(const [x,z]of [[-35,-11],[35,13],[12,-37],[-12,36]]){bench(x,z);box(0x555f53,x+1.7,.65,z,.65,1,.65);box(0x374c45,x+1.7,1.2,z,.72,.16,.72)}
 // Planters keep trees out of road lanes; clustered crowns replace empty lawns.
 for(const [x,z]of [[-13,-37],[13,-38],[-37,12],[36,12],[-38,-12],[13,38],[40,38],[-36,-36],[35,-36],[-35,40],[37,40]]){
  box(0xb9ab8e,x,.38,z,2.6,.7,2.6);box(0x53654e,x,.76,z,2.35,.08,2.35);box(0x665039,x,2,z,.38,2.5,.4);
  box(0x547554,x,3.5,z,3.3,2,3.1,.2);box(0x728e5c,x-.55,4.35,z+.15,2.5,1.8,2.5,-.15);box(0x8aa469,x+.4,4.9,z-.3,1.8,1,1.9,.3);
 }
 // Building-depth details on the surrounding residences.
 for(const [x,z]of HOME_LOTS){
  for(let floor=0;floor<3;floor++)for(let j=-1;j<=1;j++){const xx=x+j*4,yy=2+floor*3.4;if(floor===0&&j===0)continue;box(0xccbea0,xx,yy-1.05,z+6.78,2.5,.16,.35);box(0x667b78,xx,yy,z+6.73,.07,1.9,.04);if((floor+j)%2===0)box(0xc3a378,xx+.55,yy,z+6.72,.7,1.7,.04)}
  box(0x4a5658,x+5,7,z+6.9,.10,9,.13);for(let yy=3;yy<12;yy+=.6)box(0x4a5658,x+5.5,yy,z+6.9,1.1,.07,.15);
 }
 for(let i=0;i<22;i++){const angle=i/22*Math.PI*2,x=Math.sin(angle)*220,z=Math.cos(angle)*220,h=14+(i*7%17);box([0x819697,0x91a0a0,0x728b91][i%3],x,h/2,z,10,h,12)}
 const geometry=new T.BoxGeometry(1,1,1);resources.push(geometry);
 for(const [color,list]of batches){const material=new T.MeshStandardMaterial({color,roughness:.88});resources.push(material);const mesh=new T.InstancedMesh(geometry,material,list.length);list.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);objects.push(mesh)}
 return{dispose(){objects.forEach(o=>scene.remove(o));resources.forEach(r=>r.dispose())}};
}
