import * as THREE from 'three';
import type { ExperienceStore } from './providers.ts';
import { objectToWorldPosition } from '../objects/model.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { validateItemPlacement, validatePortal, type AttachedWorldItem, type Portal } from './model.ts';

export class ExperienceRegistry {
  private geometries:THREE.BufferGeometry[]=[]; private materials:THREE.Material[]=[];
  private templates=new Map<number,THREE.Mesh>();
  private ring:THREE.Mesh;private center:THREE.Mesh;
  constructor(){
    const mesh=(geometry:THREE.BufferGeometry,color:number,glow=false)=>{const material=new THREE.MeshStandardMaterial({color,emissive:glow?color:0,emissiveIntensity:glow?.65:0,roughness:.6});this.geometries.push(geometry);this.materials.push(material);return new THREE.Mesh(geometry,material);};
    this.templates.set(1,mesh(new THREE.IcosahedronGeometry(.55),0xb0bbba));
    this.templates.set(2,mesh(new THREE.CylinderGeometry(.3,.3,1.2,6),0xac744e));
    this.templates.set(3,mesh(new THREE.OctahedronGeometry(.65),0x78e8f1,true));
    this.templates.set(4,mesh(new THREE.TorusGeometry(.32,.09,6,12),0xe2c372,true));
    this.templates.set(5,mesh(new THREE.BoxGeometry(.5,.8,.5),0xffd078,true));
    this.templates.set(6,mesh(new THREE.IcosahedronGeometry(.6),0xc193ff,true));
    this.ring=mesh(new THREE.TorusGeometry(1.5,.18,8,32),0x8dcffa,true);
    const material=new THREE.MeshBasicMaterial({color:0x7e89df,transparent:true,opacity:.45,side:THREE.DoubleSide});
    const geometry=new THREE.CircleGeometry(1.3,24);this.geometries.push(geometry);this.materials.push(material);this.center=new THREE.Mesh(geometry,material);
  }
  item(type:number){const group=new THREE.Group(),mesh=this.templates.get(type)?.clone();if(!mesh)throw new Error('Unsupported item visual');mesh.position.y=.7;group.add(mesh);return group;}
  portal(){const group=new THREE.Group();const ring=this.ring.clone(),center=this.center.clone();ring.position.y=2;center.position.y=2;group.add(ring,center);return group;}
  dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
interface Entry {group:THREE.Group;items:AttachedWorldItem[];portals:Portal[];ready:boolean;request:number}
export class ExperienceLayer {
  readonly parcels=new Map<number,Entry>();
  private scene:THREE.Scene;private store:ExperienceStore;readonly registry:ExperienceRegistry;private seed:bigint;private report:(message:string)=>void;
  constructor(scene:THREE.Scene,store:ExperienceStore,registry:ExperienceRegistry,seed:bigint,report:(message:string)=>void){this.scene=scene;this.store=store;this.registry=registry;this.seed=seed;this.report=report;}
  sync(ids:Iterable<number>){const wanted=new Set(ids);for(const [id,entry]of this.parcels)if(!wanted.has(id)){entry.group.removeFromParent();entry.group.clear();this.parcels.delete(id);}for(const id of wanted)if(!this.parcels.has(id)){const group=new THREE.Group();this.scene.add(group);this.parcels.set(id,{group,items:[],portals:[],ready:false,request:0});void this.refresh(id);}}
  async refresh(id:number){const entry=this.parcels.get(id);if(!entry)return;const request=++entry.request;entry.ready=false;
    try{const [items,portals]=await Promise.all([this.store.getItems(id),this.store.getPortals(id)]);if(this.parcels.get(id)!==entry||request!==entry.request)return;
      items.forEach(validateItemPlacement);portals.forEach(validatePortal);
      const replacement=new THREE.Group();
      for(const value of [...items,...portals]){const kind='itemType'in value?'item':'portal';const mesh=kind==='item'?this.registry.item((value as AttachedWorldItem).itemType):this.registry.portal();const p=objectToWorldPosition(id,value);mesh.position.set(p.x,getGroundHeight(p.x,p.z,this.seed),p.z);mesh.rotation.y=value.rotation/100*Math.PI/180;mesh.userData={kind,entity:value};replacement.add(mesh);}
      entry.group.clear();entry.group.add(replacement);entry.items=items;entry.portals=portals;entry.ready=true;
    }catch(error){if(this.parcels.get(id)===entry&&entry.request===request)this.report(`Parcel #${id} item/portal state unavailable: ${error instanceof Error?error.message:String(error)}`);}
  }
  roots(){return [...this.parcels.values()].filter(e=>e.ready).map(e=>e.group);}
  portalRoots(){return this.roots().flatMap(group=>group.children.flatMap(child=>child.children.filter(mesh=>mesh.userData.kind==='portal')));}
  count(kind:'items'|'portals'){return [...this.parcels.values()].reduce((sum,entry)=>sum+entry[kind].length,0);}
  dispose(){for(const entry of this.parcels.values()){entry.group.removeFromParent();entry.group.clear();}this.parcels.clear();}
}
