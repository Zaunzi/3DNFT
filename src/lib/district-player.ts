import * as THREE from 'three';

export function createDistrictPlayer(scene:THREE.Scene,camera:THREE.PerspectiveCamera,canvas:HTMLCanvasElement,obstacles:()=>THREE.Object3D[],bounds:{width:number;depth:number}){
 const avatar=new THREE.Group();scene.add(avatar);avatar.visible=false;
 const materials=[new THREE.MeshStandardMaterial({color:0xe6af50}),new THREE.MeshStandardMaterial({color:0x263d49}),new THREE.MeshStandardMaterial({color:0xd6ad85})];
 const geometries:THREE.BufferGeometry[]=[];
 function part(w:number,h:number,d:number,x:number,y:number,z:number,material:number,parent:THREE.Object3D=avatar){const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const m=new THREE.Mesh(g,materials[material]);m.position.set(x,y,z);parent.add(m);return m}
 part(.48,.62,.28,0,1.12,0,0);part(.3,.31,.3,0,1.59,0,2);part(.36,.1,.36,0,1.8,0,0);
 const limbs=[new THREE.Group(),new THREE.Group(),new THREE.Group(),new THREE.Group()];limbs.forEach(g=>avatar.add(g));
 limbs[0].position.set(-.14,.81,0);limbs[1].position.set(.14,.81,0);limbs[2].position.set(-.33,1.39,0);limbs[3].position.set(.33,1.39,0);
 limbs.forEach((g,i)=>part(i<2?.18:.14,i<2?.78:.58,.18,0,i<2?-.39:-.29,0,i<2?1:0,g));
 const keys=new Set<string>();let enabled=false,yaw=0,pitch=.28,distance=6,phase=0,drag=false;
 const ray=new THREE.Raycaster();const origin=new THREE.Vector3();const direction=new THREE.Vector3();const target=new THREE.Vector3();const desired=new THREE.Vector3();
 canvas.tabIndex=0;
 function clear(){keys.clear();drag=false}
 function keydown(e:KeyboardEvent){if(!enabled||(!(document.activeElement===canvas)&&document.pointerLockElement!==canvas))return;if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault()}}
 function keyup(e:KeyboardEvent){keys.delete(e.code)}
 function pointerdown(e:PointerEvent){if(!enabled)return;canvas.focus();drag=true;canvas.setPointerCapture(e.pointerId);if(e.button===0&&!document.pointerLockElement){try{canvas.requestPointerLock?.()?.catch(()=>{})}catch{/* Drag-look remains available when pointer lock is blocked. */}}}
 function pointerup(){drag=false}
 function mousemove(e:MouseEvent){if(!enabled||(!drag&&document.pointerLockElement!==canvas))return;yaw-=e.movementX*.003;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.003,-.08,1.05)}
 function wheel(e:WheelEvent){if(!enabled)return;e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.008,2.5,12)}
 function lockchange(){if(document.pointerLockElement!==canvas)clear()}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);document.addEventListener('mousemove',mousemove);document.addEventListener('pointerlockchange',lockchange);canvas.addEventListener('pointerdown',pointerdown);window.addEventListener('pointerup',pointerup);canvas.addEventListener('wheel',wheel,{passive:false});
 function update(dt:number){if(!enabled)return;dt=Math.min(dt,.05);let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));const length=Math.hypot(forward,side);if(length){forward/=length;side/=length;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?6:3;const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*dt,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*dt;const objects=obstacles();
  // Resolve each horizontal axis separately so the capsule can slide along equipment.
  for(const [x,z]of [[dx,0],[0,dz]]){const step=Math.hypot(x,z);if(!step)continue;direction.set(x/step,0,z/step);let blocked=false;for(const height of [.55,1.25]){origin.copy(avatar.position);origin.y+=height;ray.set(origin,direction);ray.far=step+.34;if(ray.intersectObjects(objects,true).length){blocked=true;break}}if(!blocked){avatar.position.x=THREE.MathUtils.clamp(avatar.position.x+x,-bounds.width/2-8,bounds.width/2+8);avatar.position.z=THREE.MathUtils.clamp(avatar.position.z+z,-bounds.depth/2-8,bounds.depth/2+8)}}
  avatar.rotation.y=Math.atan2(dx,dz);phase+=dt*speed*2.4;
 }limbs.forEach((g,i)=>g.rotation.x=length?Math.sin(phase+(i%2)*Math.PI)*(i<2?.55:.4):0);
 target.copy(avatar.position).add(new THREE.Vector3(0,1.35,0));desired.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));ray.set(target,desired);ray.far=distance;const hit=ray.intersectObjects(obstacles(),true)[0];const actual=hit?Math.max(.45,hit.distance-.25):distance;camera.position.copy(target).addScaledVector(desired,actual);camera.position.y=Math.max(.35,camera.position.y);camera.lookAt(target);
 }
 return {avatar,get active(){return enabled},start:(x:number,z:number)=>{enabled=true;avatar.visible=true;avatar.position.set(x,.025,z);clear();canvas.focus();update(0)},stop:()=>{enabled=false;avatar.visible=false;clear();if(document.pointerLockElement===canvas)document.exitPointerLock()},update,dispose:()=>{if(document.pointerLockElement===canvas)document.exitPointerLock();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);document.removeEventListener('mousemove',mousemove);document.removeEventListener('pointerlockchange',lockchange);canvas.removeEventListener('pointerdown',pointerdown);window.removeEventListener('pointerup',pointerup);canvas.removeEventListener('wheel',wheel);scene.remove(avatar);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}};
}
