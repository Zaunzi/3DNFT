import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export function createOilScene(el:HTMLDivElement,size:number,level=0){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;el.appendChild(renderer.domElement);
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(36,1,.1,1000);camera.position.set(78,60,84);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.2,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=40;controls.maxDistance=160;controls.maxPolarAngle=Math.PI/2.2;
 scene.add(new THREE.HemisphereLight(0xcce7ff,0x91654a,2.6));const light=new THREE.DirectionalLight(0xffd39a,4);light.position.set(-28,48,20);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-40,right:40,top:40,bottom:-40});scene.add(light);
 const model=createOilParcel(size,level);scene.add(model.group);
 const resize=()=>{const w=el.clientWidth,h=Math.max(1,el.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(el);resize();let frame=0;const start=performance.now();
 function animate(){const t=(performance.now()-start)/1000;model.animate(t);controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate)}animate();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();model.dispose();renderer.dispose();renderer.domElement.remove()};
}

export function createOilParcel(size:number,level=0){
 const land=new THREE.Group();const width=[6,Math.sqrt(108),Math.sqrt(216)][size];const depth=width*.77;
 const materials=new Map<number,THREE.MeshStandardMaterial>();
 function mesh(geometry:THREE.BufferGeometry,color:number,x:number,y:number,z:number,parent:THREE.Object3D=land){let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:.8,metalness:color===0x34454b?.5:.08,flatShading:true});materials.set(color,mat)}const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 function box(w:number,h:number,d:number,c:number,x:number,y:number,z:number,parent:THREE.Object3D=land){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent)}
 box(width,1,width*.77,0x7b5743,0,-.6,0);box(width+.08,.22,width*.77+.08,0xd6b482,0,0,0);box(width-.15,.08,width*.77-.15,0xe3c497,0,.12,0);
 for(let n=0;n<3;n++)box(width+.01,.07,width*.77+.01,0xa47b56,0,-.4-n*.2,0);
 const arms:THREE.Group[]=[];const rods:THREE.Mesh[]=[];
 function pump(x:number,z:number,rotation=0){const g=new THREE.Group();g.position.set(x,.19,z);g.rotation.y=rotation;land.add(g);box(2,.13,1.25,0xa5a398,0,0,0,g);box(1.7,.12,.75,0x34454b,0,.15,0,g);
 for(const side of [-1,1]){const leg=box(.13,1.65,.15,0x34454b,0,.95,side*.36,g);leg.rotation.z=-.17;box(.85,.12,.13,0x34454b,-.12,.48,side*.36,g);}
 box(.2,.2,.95,0x34454b,-.12,1.72,0,g);const arm=new THREE.Group();arm.position.set(-.12,1.75,0);g.add(arm);arms.push(arm);box(2.2,.18,.18,0xe3a548,.25,0,0,arm);box(.28,.62,.28,0xdc9641,1.28,-.15,0,arm);box(.28,.24,.56,0x34454b,-.9,0,0,arm);
 const rod=box(.04,1.1,.04,0xc7d0ca,1.18,.75,0,g);rods.push(rod);mesh(new THREE.CylinderGeometry(.16,.16,.24,12),0x34454b,1.18,.2,0,g);
 box(.55,.5,.55,0x435962,-.7,.48,0,g);mesh(new THREE.CylinderGeometry(.32,.32,.17,14),0xdb9741,-.48,.62,.38,g).rotation.x=Math.PI/2;
 for(let step=0;step<4;step++)box(.22,.03,.06,0xd9d5c1,-.45,.3+step*.27,-.45,g);
 }
 // Keep machinery human-scaled; distribute work areas across the available land.
 const pumpSites=size===0?[{x:-.8,z:-.25}]:size===1?
  [{x:-width*.24,z:-depth*.22},{x:width*.24,z:-depth*.04}]:
  [{x:-width*.28,z:-depth*.26},{x:width*.28,z:-depth*.26},{x:0,z:depth*.05}];
 pumpSites.forEach(({x,z})=>pump(x,z));
 function tank(x:number,z:number,r:number){mesh(new THREE.CylinderGeometry(r,r,1.1,20),0xa8b9b7,x,.76,z);mesh(new THREE.CylinderGeometry(r*1.01,r*1.01,.06,20),0x5b7377,x,1.32,z);mesh(new THREE.CylinderGeometry(r*1.01,r*1.01,.07,20),0x34454b,x,.26,z);for(let i=0;i<5;i++)box(.2,.03,.05,0x34454b,x+r,.3+i*.2,z);box(.04,1.05,.04,0x34454b,x+r-.1,.8,z);box(.04,1.05,.04,0x34454b,x+r+.1,.8,z)}
 const serviceZ=depth*.31;
 const tankX=width/2-1;
 tank(tankX,serviceZ,.63);
 if(size>=1)tank(tankX-1.7,serviceZ,.63);
 if(size>=2)tank(tankX-3.4,serviceZ,.63);
 // A full-width collection manifold connects each spaced pump to storage.
 const manifoldZ=serviceZ-.95;
 box(width-1.5,.1,.14,0x66787b,0,.28,manifoldZ);
 pumpSites.forEach(({x,z})=>{const length=manifoldZ-z;box(.1,.1,length,0x66787b,x,.28,z+length/2)});
 box(.14,.1,.95,0x66787b,tankX,.28,serviceZ-.475);
 const cabinX=-width/2+1;
 box(1.15,.7,.85,0xf0dfb8,cabinX,.55,serviceZ);box(1.25,.12,.95,0x435962,cabinX,.98,serviceZ);box(.25,.5,.03,0x435962,cabinX,.45,serviceZ+.44);box(.25,.2,.035,0x8ab8bc,cabinX-.36,.65,serviceZ+.44);
 for(let i=0;i<8;i++){const a=i*2.33;mesh(new THREE.DodecahedronGeometry(.12+(i%3)*.05),0xb39065,Math.cos(a)*(width/2-.25),.25,Math.sin(a)*(width*.385-.25))}
 for(let i=0;i<Math.floor(width);i++){const x=-width/2+.4+i;box(.055,.55,.055,0x34454b,x,.42,-width*.385+.22);box(.85,.025,.03,0x7d857a,x+.43,.58,-width*.385+.22)}

 for(let i=0;i<level;i++)box(.45,.8,.6,0xe3a548,-width/2+.7+i*.6,.6,-width*.385+.8);
 // Model units become metres: a 2.2-unit walking beam is 8.8 m long.
 // The finished sand surface is the shared y=0 datum in both viewers.
 land.children.forEach(child=>child.position.y-=.16);
 land.scale.setScalar(4);
 return {group:land,animate:(t:number)=>{arms.forEach((a,i)=>a.rotation.z=Math.sin(t*(1.25+level*.3)+i*.8)*.22);rods.forEach((r,i)=>r.position.y=.75+Math.sin(t*(1.25+level*.3)+i*.8)*.23)},dispose:()=>{land.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});materials.forEach(m=>m.dispose())}};
}
