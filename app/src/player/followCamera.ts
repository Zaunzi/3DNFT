import {PerspectiveCamera,Raycaster,Vector3,type Object3D} from 'three';
/** Camera is presentation only; the player's collision anchor remains at eye height. */
export function updateFollowCamera(view:PerspectiveCamera,anchor:PerspectiveCamera,obstacles:Object3D[]){
 const target=anchor.position.clone();const backward=new Vector3(0,0,1).applyQuaternion(anchor.quaternion);const ray=new Raycaster(target,backward,.05,4.5);
 obstacles.forEach(o=>o.updateWorldMatrix(true,true));
 const hit=ray.intersectObjects(obstacles,true)[0];const distance=hit?Math.max(.12,hit.distance-.25):4.5;
 view.position.copy(target).addScaledVector(backward,distance);view.quaternion.copy(anchor.quaternion);view.updateMatrixWorld();return distance;
}
