import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const RESIDENTS=[
 {id:38,path:[[-12,-12],[-34,-12]],speed:.9},
 {id:981,path:[[12,-12],[34,-12]],speed:.8},
 {id:64,path:[[-12,13],[-34,13]],speed:.85},
 {id:185,path:[[12,13],[34,13]],speed:1},
 {id:296,path:[[-9.5,-17],[-9.5,-40]],speed:.9},
 {id:4,path:[[9.5,18],[9.5,42]],speed:.85},
 {id:10,path:[[37,-11],[54,-11]],speed:.75},
 {id:67,path:[[-38,18],[-38,27]],speed:.8}
] as const;
export function addResidents(scene:T.Scene){
 const residents:{root:T.Group;mixer:T.AnimationMixer;walk:T.AnimationAction;idle:T.AnimationAction;path:readonly(readonly number[])[];destination:number;wait:number;speed:number;elapsed:number}[]=[];
 let disposed=false;
 function free(root:T.Group){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}
 // Stagger loading to keep player input responsive and avoid eight simultaneous parses.
 const ready=(async()=>{for(const [index,spec] of RESIDENTS.entries()){if(disposed)break;try{const g=await new GLTFLoader().loadAsync(`/cryptodoodz/models/${String(spec.id).padStart(4,'0')}.glb`);if(disposed){free(g.scene);break}const walkClip=g.animations.find(c=>c.name==='Walk'),idleClip=g.animations.find(c=>c.name==='Idle');if(!walkClip||!idleClip){free(g.scene);continue}const root=g.scene;root.name=`Resident_${spec.id}`;root.position.set(spec.path[0][0],.23,spec.path[0][1]);root.rotation.y=Math.atan2(spec.path[1][0]-spec.path[0][0],spec.path[1][1]-spec.path[0][1]);root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=true}});scene.add(root);const mixer=new T.AnimationMixer(root),walk=mixer.clipAction(walkClip),idle=mixer.clipAction(idleClip);idle.play();residents.push({root,mixer,walk,idle,path:spec.path,destination:1,wait:1+index*.3,speed:spec.speed,elapsed:0})}catch{/* A failed NPC download must not prevent entering the world. */}}return residents.length})();
 return {ready,update(dt:number,player:T.Vector3){for(const n of residents){const distance=n.root.position.distanceTo(player);n.root.visible=distance<62;if(n.wait>0){n.wait-=dt;if(n.wait<=0){n.idle.fadeOut(.3);n.walk.reset().fadeIn(.3).play()}}else{const to=n.path[n.destination],dx=to[0]-n.root.position.x,dz=to[1]-n.root.position.z,length=Math.hypot(dx,dz);if(length<.1){n.destination=(n.destination+1)%n.path.length;n.wait=2.5+(n.destination%2);n.walk.fadeOut(.3);n.idle.reset().fadeIn(.3).play()}else if(distance>1.1){const step=Math.min(length,n.speed*dt);n.root.position.x+=dx/length*step;n.root.position.z+=dz/length*step;const target=Math.atan2(dx,dz);n.root.rotation.y+=T.MathUtils.euclideanModulo(target-n.root.rotation.y+Math.PI,Math.PI*2)-Math.PI}}
 n.elapsed+=dt;if(n.root.visible&&(distance<25||n.elapsed>.1)){n.mixer.update(n.elapsed);n.elapsed=0}else if(!n.root.visible)n.elapsed=0}},dispose(){disposed=true;for(const n of residents){n.mixer.stopAllAction();scene.remove(n.root);free(n.root)}residents.length=0}};
}
