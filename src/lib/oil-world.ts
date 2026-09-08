import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createOilParcel} from './oil-scene';

// One world unit is one metre. Cells leave clearance for roads and pavements.
export const DISTRICT_PLOTS=[0,1,2,0,1,2].map((size,i)=>({size,x:(i%3-1)*76,z:Math.floor(i/3)*76-38}));
export function createDistrict(host:HTMLDivElement,select:(size:number)=>void,levels:number[]=[0,0,0]){
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x172126);host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x172126,300,650);
 const camera=new THREE.PerspectiveCamera(45,1,.5,1000);camera.position.set(140,150,180);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=15;controls.maxDistance=380;controls.target.set(0,0,0);
 scene.add(new THREE.HemisphereLight(0xcce7ff,0x91654a,3));const sun=new THREE.DirectionalLight(0xffd39a,3);sun.position.set(-50,100,50);scene.add(sun);
 const materials:THREE.Material[]=[];
 function box(w:number,h:number,d:number,color:number,x:number,y:number,z:number){const mat=new THREE.MeshStandardMaterial({color});materials.push(mat);const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);scene.add(mesh);return mesh}
 box(300,1,190,0x8e7759,0,-5,0);box(290,.15,12,0x354248,0,-.25,0);
 for(const z of [-8,8])box(290,.3,3,0xb8b8a3,0,-.1,z);
 for(let x=-140;x<145;x+=12)box(5,.04,.18,0xe8c684,x,-.15,0);
 const models=DISTRICT_PLOTS.map(p=>{const m=createOilParcel(p.size,levels[p.size]??0);m.group.position.set(p.x,0,p.z);m.group.userData.size=p.size;scene.add(m.group);return m});
 // A fixed 1.8 m mannequin provides a human scale reference by the road.
 box(.55,1.15,.3,0xefb557,-13,.575,7);const head=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),new THREE.MeshStandardMaterial({color:0xf4d7ad}));head.position.set(-13,1.6,7);scene.add(head);materials.push(head.material);
 const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();let down={x:0,y:0};
 const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY}};
 const onUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(models.map(m=>m.group),true)[0];if(hit){let obj:THREE.Object3D=hit.object;while(obj.parent&&obj.userData.size===undefined)obj=obj.parent;if(obj.userData.size!==undefined)select(obj.userData.size)}};
 renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(host);resize();let frame=0;const start=performance.now();
 function animate(){models.forEach(m=>m.animate((performance.now()-start)/1000));controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate)}animate();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);models.forEach(m=>m.dispose());scene.children.forEach(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove()};
}
