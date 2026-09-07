import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export function createIsland(el: HTMLDivElement, level: number) {
 const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
 el.appendChild(renderer.domElement); const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(12,10,14);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=11;controls.maxDistance=25;controls.maxPolarAngle=Math.PI/2.15;controls.target.set(0,0,0);
 scene.add(new THREE.HemisphereLight(0xccefff,0x675641,2.6));const sun=new THREE.DirectionalLight(0xffe4b2,3.5);sun.position.set(-5,12,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10});scene.add(sun);
 const island=new THREE.Group();scene.add(island);
 function mesh(g:THREE.BufferGeometry,c:number,x:number,y:number,z:number,parent:THREE.Object3D=island){const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 function box(w:number,h:number,d:number,c:number,x:number,y:number,z:number,p:THREE.Object3D=island){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,p)}
 mesh(new THREE.CylinderGeometry(5.3,3.8,1.5,7),0x9a7251,0,-1,0);mesh(new THREE.CylinderGeometry(5.36,5.3,.35,7),0x89b957,0,-.08,0);mesh(new THREE.ConeGeometry(3.8,2.4,7),0x765742,0,-2.7,0).rotation.z=Math.PI;
 for(let i=0;i<12;i++){const a=i*2.4;mesh(new THREE.DodecahedronGeometry(.25+i%3*.12),0xabc577,Math.cos(a)*4.65,.16,Math.sin(a)*4.65)}
 // Cottage and roof.
 box(1.55,1.25,1.55,0xffe4bb,-2.1,.72,-1.4);const roof=mesh(new THREE.ConeGeometry(1.4,.95,4),0xbf6849,-2.1,1.8,-1.4);roof.rotation.y=Math.PI/4;box(.42,.76,.05,0x604537,-2.1,.48,-.59);box(.4,.38,.06,0x81cdd0,-2.6,1,-.59);box(.25,.8,.25,0x9e6346,-2.65,1.8,-1.55);
 for(let i=0;i<6;i++)box(.45,.08,.4,0xd5c5a2,-1.9+i*.25,.17,-.1+i*.47);
 const crops:THREE.Object3D[]=[];
 function field(x:number,z:number){box(1.8,.13,2.4,0x664932,x,.18,z);for(let row=0;row<4;row++){box(.07,.05,2.2,0x987047,x-.65+row*.43,.27,z);for(let j=0;j<5;j++){const stalk=new THREE.Group();stalk.position.set(x-.65+row*.43,.26,z-.9+j*.44);island.add(stalk);box(.045,.5,.045,0x7f9942,0,.25,0,stalk);mesh(new THREE.ConeGeometry(.12,.3,5),0xf3ca56,0,.56,0,stalk);const leaf=box(.23,.045,.08,0x9caf4b,.08,.26,0,stalk);leaf.rotation.z=.65;crops.push(stalk)}}}
 field(.5,.6);if(level>=1)field(2.65,.3);
 function tree(x:number,z:number,s:number){mesh(new THREE.CylinderGeometry(.13,.2,1.2,6),0x77543a,x,.6,z);mesh(new THREE.ConeGeometry(.8*s,1.6*s,7),0x477c51,x,1.5,z);mesh(new THREE.ConeGeometry(.6*s,1.3*s,7),0x6a9c59,x,2.15,z)}
 tree(-3.1,1.7,1);tree(-.5,-3.5,.8);tree(3,-2.5,.9);
 for(let i=0;i<7;i++){const x=-2.9+i*.85;box(.1,.7,.1,0xf0deb5,x,.48,3.3);if(i<6){box(.85,.09,.08,0xe5cca2,x+.42,.55,3.3);box(.85,.09,.08,0xe5cca2,x+.42,.3,3.3)}}
 if(level>=2){box(.25,.07,3.3,0x69cad5,1.55,.28,.4);mesh(new THREE.CylinderGeometry(.58,.5,.8,12),0x79adba,3,.55,-1.65);mesh(new THREE.CylinderGeometry(.49,.49,.03,12),0x87def0,3,.97,-1.65)}
 const blades=new THREE.Group();if(level>=3){mesh(new THREE.CylinderGeometry(.4,.65,2.5,8),0xf6dfaf,.5,1.4,-2.6);mesh(new THREE.ConeGeometry(.7,.8,8),0xb86448,.5,3,-2.6);blades.position.set(.5,2.45,-2.04);island.add(blades);for(let i=0;i<4;i++){const b=new THREE.Group();b.rotation.z=i*Math.PI/2;blades.add(b);box(.13,1.25,.1,0x6d543d,0,.6,0,b);box(.35,.77,.05,0xfff1d3,.12,.85,.03,b)}mesh(new THREE.SphereGeometry(.15),0x78563d,.5,2.45,-1.93)}
 const clouds:THREE.Group[]=[];for(let i=0;i<5;i++){const c=new THREE.Group();scene.add(c);c.position.set(Math.cos(i*1.3)*9,-2-i%2,Math.sin(i*1.3)*8);for(let j=0;j<3;j++)mesh(new THREE.IcosahedronGeometry(.7+j*.2,1),0xf2f5dc,j*.7,0,0,c);clouds.push(c)}
 const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(el);resize();let frame=0;const start=performance.now();const animate=()=>{const t=(performance.now()-start)/1000;crops.forEach((c,i)=>c.rotation.z=Math.sin(t*1.5+i)*.055);blades.rotation.z=t*.5;island.position.y=Math.sin(t*.6)*.06;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate)};animate();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material;(Array.isArray(m)?m:[m]).forEach(v=>v.dispose())}});renderer.dispose();renderer.domElement.remove()};

}
