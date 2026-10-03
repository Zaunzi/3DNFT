import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EYE_HEIGHT} from '../world/constants.ts';
/** Local animated player body. It has no custody, collision, or world-state record. */
export class PlayerAvatar {
 private root?:THREE.Group;private mixer?:THREE.AnimationMixer;private actions=new Map<string,THREE.AnimationAction>();private current='';private disposed=false;
 private scene:THREE.Scene;
 constructor(scene:THREE.Scene,id:bigint){this.scene=scene;void new GLTFLoader().loadAsync(`/cryptodoodz/models/${String(id).padStart(4,'0')}.glb`).then(gltf=>{
  if(this.disposed){this.release(gltf.scene);return;}
  const model=gltf.scene,bounds=new THREE.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y,scale=1.8/Math.max(height,.001);model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale;
  this.root=new THREE.Group();this.root.add(model);scene.add(this.root);this.mixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>this.actions.set(clip.name,this.mixer!.clipAction(clip)));model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;if(o instanceof THREE.SkinnedMesh)o.frustumCulled=false;}});
 }).catch(()=>{/* A failed cosmetic model must never prevent exploration. */});}
 update(camera:THREE.PerspectiveCamera,dt:number,clip:'Idle'|'Walk'|'Run'|'Jump',distance:number){
  if(!this.root)return;this.root.position.set(camera.position.x,camera.position.y-EYE_HEIGHT,camera.position.z);this.root.rotation.y=camera.rotation.y+Math.PI;this.root.visible=distance>.65;
  if(clip!==this.current){const next=this.actions.get(clip);if(next){this.actions.get(this.current)?.fadeOut(.15);next.reset().fadeIn(.15).play();this.current=clip;}}this.mixer?.update(dt);
 }

 private release(root:THREE.Object3D){const textures=new Set<THREE.Texture>();root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});m.dispose();}}});textures.forEach(t=>t.dispose());}
 dispose(){this.disposed=true;this.mixer?.stopAllAction();if(this.root){this.scene.remove(this.root);this.release(this.root);}}
}
