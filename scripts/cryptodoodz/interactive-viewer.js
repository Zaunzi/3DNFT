import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const host=document.querySelector('#stage'),status=document.querySelector('#status');
const buttons=[...document.querySelectorAll('button[data-clip]')];
const config=JSON.parse(document.querySelector('#dood-config').textContent);
async function start(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(config.background);
 const camera=new THREE.PerspectiveCamera(35,1,.01,100);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.domElement.setAttribute('aria-label',`Interactive ${config.name}. Drag to rotate; scroll to zoom.`);
 host.append(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;
 controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI*.85;
 scene.add(new THREE.HemisphereLight(0xffffff,0x777b82,2.3));
 const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);
 const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(3,2,-3);scene.add(fill);
 const gltf=await new GLTFLoader().loadAsync(config.model);
 const required=['Idle','Walk','Run','Jump','Shoot','Wave'];
 for(const name of required)if(!gltf.animations.some(a=>a.name===name))throw Error('Animation missing');
 scene.add(gltf.scene);
 const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
 const target=new THREE.Vector3(0,(bounds.min.y+bounds.max.y)/2+.12,0);
 controls.target.copy(target);
 // Reserve space for the jump's upward motion and tall hats at narrow sizes.
 function resize(){
  const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);camera.aspect=w/h;
  const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
  const distance=Math.max((size.y+.85)/2/Math.tan(halfFov),(size.x+.5)/2/(Math.tan(halfFov)*camera.aspect));
  const direction=camera.position.clone().sub(controls.target).normalize();
  if(!direction.lengthSq())direction.set(.25,.1,1).normalize();
  camera.position.copy(target).addScaledVector(direction,distance);controls.minDistance=distance*.65;controls.maxDistance=distance*2;
  camera.updateProjectionMatrix();renderer.setSize(w,h);controls.update();
 }
 camera.position.copy(target).add(new THREE.Vector3(.25,.1,1));
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const mixer=new THREE.AnimationMixer(gltf.scene),actions=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));
 function select(name){
  mixer.stopAllAction();const action=actions.get(name);action.reset().setLoop(THREE.LoopRepeat,Infinity).play();
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.clip===name));
  host.dataset.animation=name;status.textContent=name;
 }
 for(const button of buttons){button.disabled=false;button.addEventListener('click',()=>select(button.dataset.clip));}
 select('Idle');document.querySelector('#poster').hidden=true;host.dataset.ready='true';
 const clock=new THREE.Clock();let disposed=false;
 renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);if(document.hidden)return;mixer.update(dt);controls.update();renderer.render(scene,camera);});
 addEventListener('pagehide',()=>{if(disposed)return;disposed=true;observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();renderer.dispose();gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});},{once:true});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='3D paused. Reload to resume.';for(const b of buttons)b.disabled=true;});
}
start().catch(()=>{status.textContent='Unable to load 3D. Reload to retry.';host.dataset.ready='error';});
