import {type Object3D,Vector3} from 'three';
import {localPoint} from '../objects/building.ts';
const OFFSET=.28;
/** Mounting is derived from canonical X/Z + rotation and saved solid walls.
 * No local-only mount flags: other clients and the showcase obtain the same result. */
export function wallMount(x:number,z:number,rotation:number,roots:Object3D[],snap=false,target?:{parcelId:number;wallId:number}){
 let best:{x:number;z:number;y:number;rotation:number;distance:number}|undefined;
 for(const root of roots)root.traverse(wall=>{
  if(wall.userData.kind!=='persistent'||wall.userData.objectType!==8)return;
  if(target&&(target.wallId===0||wall.userData.objectId!==target.wallId||wall.userData.tokenId!==target.parcelId))return;
  const p=wall.getWorldPosition(new Vector3()),angle=wall.rotation.y,r=angle*180/Math.PI*100,q=localPoint(x,z,p.x,p.z,r),side=q.z<0?-1:1;
  if(Math.abs(q.x)>(snap?2:.92)||Math.abs(Math.abs(q.z)-OFFSET)>(snap?.65:.025))return;
  const yaw=((Math.round(r)+(side<0?18000:0))%36000+36000)%36000;
  const diff=Math.abs(((rotation-yaw+54000)%36000)-18000);
  if(!snap&&diff>2)return;
  // Center new placements across the wall. Both the 3.2m wall panel and
  // the 1.5x art frame have their visual center 2.1m above their group origin.
  const u=snap?0:Math.max(-.9,Math.min(.9,q.x)),v=side*OFFSET;
  const y=p.y+(target||snap?0:.15);
  const px=p.x+u*Math.cos(angle)+v*Math.sin(angle),pz=p.z-u*Math.sin(angle)+v*Math.cos(angle),distance=Math.hypot(x-px,z-pz);
  if(!best||distance<best.distance-.001||Math.abs(distance-best.distance)<.001&&y>best.y)best={x:px,z:pz,y,rotation:yaw,distance};
 });return best;
}
/** A ray can hit a trim/board child. Resolve its persistent parent before snapping. */
export function hitWall(object:Object3D,parcelId:number){
 let root:Object3D|null=object;
 while(root&&root.userData.kind!=='persistent')root=root.parent;
 return root?.userData.objectType===8&&root.userData.tokenId===parcelId?{parcelId,wallId:Number(root.userData.objectId)}:undefined;
}
export function setArtMounted(object:Object3D,mounted:boolean){for(const child of object.children)if(child.userData.artPodium)child.visible=!mounted;}
