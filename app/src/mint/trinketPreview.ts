import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
/** Every preview owns its GPU resources; late loads are disposed after selection changes. */
export function trinketPreview(host:HTMLElement,id:number){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
 renderer.domElement.setAttribute('aria-label','3D instrument preview. Drag to rotate; scroll to zoom.');host.replaceChildren(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.autoRotateSpeed=.7;
 controls.addEventListener('start',()=>{controls.autoRotate=false;});
 scene.add(new THREE.HemisphereLight(0xffffff,0x526246,3));const sun=new THREE.DirectionalLight(0xfff2d0,4);sun.position.set(3,5,4);scene.add(sun);
 let disposed=false,model:THREE.Object3D|undefined;
 const release=(root:THREE.Object3D)=>{const textures=new Set<THREE.Texture>();root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);m.dispose();}}});textures.forEach(t=>t.dispose());};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 void new GLTFLoader().loadAsync(new URL(`../trinkets/models/${id}.glb`,import.meta.url).href).then(gltf=>{
  if(disposed){release(gltf.scene);return;}model=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);scene.add(model);
  const radius=Math.max(size.length()/2,.1),distance=radius/Math.sin(THREE.MathUtils.degToRad(19))*1.15;camera.position.set(distance*.65,distance*.45,distance*.65);camera.near=radius/100;camera.far=distance*20;camera.updateProjectionMatrix();controls.minDistance=radius*1.2;controls.maxDistance=distance*3;controls.update();
 }).catch(()=>{if(!disposed){const note=document.createElement('p');note.textContent='3D preview unavailable. Please reload to try again.';host.append(note);}});
 renderer.setAnimationLoop(()=>{if(document.hidden)return;controls.update();renderer.render(scene,camera);});
 return ()=>{disposed=true;observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();if(model)release(model);renderer.dispose();renderer.domElement.remove();};
}
