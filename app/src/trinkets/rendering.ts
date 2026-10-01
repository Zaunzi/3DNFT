import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ExperienceRegistry} from '../items/rendering.ts';
import {validateItemPlacement, type AttachedWorldItem} from './model.ts';
export class TrinketRegistry extends ExperienceRegistry {
  private cache=new Map<number,Promise<THREE.Group>>();
  private loaded:THREE.Group[]=[];private closed=false;
  private placeholderGeometry=new THREE.BoxGeometry(.6,.2,.6);
  private placeholderMaterial=new THREE.MeshStandardMaterial({color:0xc7a36a});
  override validateItem(item:AttachedWorldItem){validateItemPlacement(item);}
  override item(type:number){
    const group=new THREE.Group();const placeholder=new THREE.Mesh(this.placeholderGeometry,this.placeholderMaterial);placeholder.position.y=.1;group.add(placeholder);
    let request=this.cache.get(type);
    if(!request){request=new GLTFLoader().loadAsync(new URL(`./models/${type}.glb`,import.meta.url).href).then(gltf=>{if(this.closed)this.release(gltf.scene);else this.loaded.push(gltf.scene);return gltf.scene;});this.cache.set(type,request);}
    void request.then(template=>{if(this.closed)return;group.clear();const model=template.clone(true);model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});group.add(model);}).catch(()=>{group.userData.modelUnavailable=true;});
    return group;
  }
  private release(group:THREE.Group){const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  override dispose(){this.closed=true;this.loaded.forEach(g=>this.release(g));this.loaded=[];this.cache.clear();this.placeholderGeometry.dispose();this.placeholderMaterial.dispose();super.dispose();}
}
