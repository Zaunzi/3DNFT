import * as THREE from 'three';
import type { ExperienceStore } from './providers.ts';
import { objectToWorldPosition } from '../objects/model.ts';
import { getGroundHeight } from '../world/terrain.ts';
import { validateItemPlacement, validatePortal, type AttachedWorldItem, type Portal } from './model.ts';

export class ExperienceRegistry {
  private geometries:THREE.BufferGeometry[]=[]; private materials:THREE.Material[]=[];
  private templates=new Map<number,THREE.Mesh>();
  private portalTemplate=new THREE.Group();
  constructor(){
    const mesh=(geometry:THREE.BufferGeometry,color:number,glow=false)=>{const material=new THREE.MeshStandardMaterial({color,emissive:glow?color:0,emissiveIntensity:glow?.65:0,roughness:.6});this.geometries.push(geometry);this.materials.push(material);return new THREE.Mesh(geometry,material);};
    this.templates.set(1,mesh(new THREE.IcosahedronGeometry(.55),0xb0bbba));
    this.templates.set(2,mesh(new THREE.CylinderGeometry(.3,.3,1.2,6),0xac744e));
    this.templates.set(3,mesh(new THREE.OctahedronGeometry(.65),0x78e8f1,true));
    this.templates.set(4,mesh(new THREE.TorusGeometry(.32,.09,6,12),0xe2c372,true));
    this.templates.set(5,mesh(new THREE.BoxGeometry(.5,.8,.5),0xffd078,true));
    this.templates.set(6,mesh(new THREE.IcosahedronGeometry(.6),0xc193ff,true));
    const add=(g:THREE.BufferGeometry,color:number,x:number,y:number,z:number,glow=false)=>{const m=mesh(g,color,glow);m.position.set(x,y,z);this.portalTemplate.add(m);return m;};
    add(new THREE.CylinderGeometry(1.8,1.95,.22,32),0x555f5a,0,.11,0).scale.z=.45;
    // Individual voussoirs and inlaid runes replace the placeholder luminous torus.
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const block=add(new THREE.BoxGeometry(.48,.29,.46),i%3===0?0x718079:0x59675f,Math.cos(a)*1.55,1.95+Math.sin(a)*1.55,0);block.rotation.z=a+Math.PI/2;
      const rune=add(new THREE.BoxGeometry(.065,.15,.025),0x66dbcd,Math.cos(a)*1.55,1.95+Math.sin(a)*1.55,.25,true);rune.rotation.z=a;
    }
    const inner=add(new THREE.TorusGeometry(1.36,.035,8,64),0x69e4ce,0,1.95,0,true);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform float time;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float swirl=sin(r*23.-a*3.-time*1.3)*.5+.5;float waves=sin(p.x*9.+sin(p.y*8.+time)*2.-time)*.5+.5;float edge=smoothstep(.72,1.,r);vec3 color=mix(vec3(.055,.10,.24),vec3(.12,.50,.48),swirl*.5+waves*.2);color+=vec3(.28,.8,.7)*pow(edge,3.);gl_FragColor=vec4(color,.82+edge*.16);}`});
    const geometry=new THREE.CircleGeometry(1.34,64);this.geometries.push(geometry);this.materials.push(material);const surface=new THREE.Mesh(geometry,material);surface.position.y=1.95;this.portalTemplate.add(surface);
    // Shared material clock changes presentation only; custody/state stay deterministic.
    inner.userData.portalGlow=true;
  }
  item(type:number){const group=new THREE.Group(),mesh=this.templates.get(type)?.clone();if(!mesh)throw new Error('Unsupported item visual');mesh.position.y=.7;group.add(mesh);return group;}
  portal(){const group=this.portalTemplate.clone(true);group.traverse(o=>{if(o instanceof THREE.Mesh && o.material instanceof THREE.ShaderMaterial)o.onBeforeRender=()=>{(o.material as THREE.ShaderMaterial).uniforms.time.value=performance.now()/1000;};});return group;}
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
