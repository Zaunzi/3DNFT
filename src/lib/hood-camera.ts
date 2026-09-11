import {Vector3} from 'three';

// Shift both the camera and its aim line right, leaving the Dood left of the reticle.
export function shoulderFrame(player:Vector3,yaw:number,pitch:number,driving:boolean,pivot:Vector3,focus:Vector3,position:Vector3,indoors=false){
 pivot.copy(player);pivot.y+=driving?1.1:1.65;
 focus.copy(pivot);
 if(!driving){const shoulder=indoors?.65:1.05;focus.x-=Math.cos(yaw)*shoulder;focus.z+=Math.sin(yaw)*shoulder;}
 const distance=driving?9:indoors?2.7:4.8;
 position.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance).add(focus);
}
