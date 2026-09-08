import * as THREE from 'three';
import {createDistrictPlayer} from './district-player';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createOilParcel} from './oil-scene';
import {DISTRICT_PLOTS,plotById,DISTRICT_WIDTH,DISTRICT_DEPTH,DISTRICT_BLOCKS,DISTRICT_ROADS} from './district';
export {DISTRICT_PLOTS} from './district';
export function createDistrict(host:HTMLDivElement,select:(id:number)=>void){
 const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x172126);host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,1,.5,12000);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=25;controls.maxDistance=5500;
 scene.add(new THREE.HemisphereLight(0xcce7ff,0x91654a,3));const sun=new THREE.DirectionalLight(0xffd39a,3);sun.position.set(-50,100,50);scene.add(sun);
 const geometry=new THREE.BoxGeometry(1,1,1);const materials:THREE.Material[]=[];
 function boxes(items:{x:number;y:number;z:number;w:number;h:number;d:number}[],color:number){const mat=new THREE.MeshStandardMaterial({color});materials.push(mat);const mesh=new THREE.InstancedMesh(geometry,mat,items.length);const matrix=new THREE.Matrix4();items.forEach((p,i)=>{matrix.compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion(),new THREE.Vector3(p.w,p.h,p.d));mesh.setMatrixAt(i,matrix)});scene.add(mesh);return mesh}
 // Surrounding sand sits outside the district, never beneath the laneways or roads.
 boxes([
  {x:0,y:-2.5,z:-DISTRICT_DEPTH/2-6,w:DISTRICT_WIDTH+24,h:5,d:12},
  {x:0,y:-2.5,z:DISTRICT_DEPTH/2+6,w:DISTRICT_WIDTH+24,h:5,d:12},
  {x:-DISTRICT_WIDTH/2-6,y:-2.5,z:0,w:12,h:5,d:DISTRICT_DEPTH},
  {x:DISTRICT_WIDTH/2+6,y:-2.5,z:0,w:12,h:5,d:DISTRICT_DEPTH}
 ],0xe3c497);
 // Block paving fills alleys; roads stop at intersections instead of overlapping pavements.
 boxes(DISTRICT_BLOCKS.map(b=>({...b,y:-.149,h:.3})),0xe3c497);
 boxes(DISTRICT_ROADS.map(r=>({...r,y:-.07,h:.15})),0x354248);
 const markings=[];
 for(const r of DISTRICT_ROADS){const vertical=r.w===12;const length=vertical?r.d:r.w;for(let n=-length/2+8;n<length/2-5;n+=14){const x=r.x+(vertical?0:n),z=r.z+(vertical?n:0);if(vertical&&DISTRICT_ROADS.some(other=>other.w!==12&&Math.abs(z-other.z)<10))continue;markings.push({x,z,y:.012,w:vertical?.16:5,d:vertical?5:.16,h:.01})}}
 boxes(markings,0xe5c782);
 const bases=boxes(DISTRICT_PLOTS.map(p=>({x:p.x,y:-.045,z:p.z,w:[24,Math.sqrt(108)*4,Math.sqrt(216)*4][p.size],h:.1,d:[24,Math.sqrt(108)*4,Math.sqrt(216)*4][p.size]*.77})),0xe3c497);
 const details=new Map<number,ReturnType<typeof createOilParcel>>();const levels=new Map<number,number>();
 const player=createDistrictPlayer(scene,camera,renderer.domElement,()=>[...details.values()].filter(m=>m.group.position.distanceTo(player.avatar.position)<80).map(m=>m.group),{width:DISTRICT_WIDTH,depth:DISTRICT_DEPTH});
 let selectedId=1;
 function stopWalking(){player.stop();controls.enabled=true;camera.near=.5;camera.updateProjectionMatrix()}
 const labels=new Map<number,THREE.Sprite>();
 function removeDetail(id:number,m:ReturnType<typeof createOilParcel>){scene.remove(m.group);m.dispose();details.delete(id);const label=labels.get(id);if(label){scene.remove(label);label.material.map?.dispose();label.material.dispose();labels.delete(id)}}
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,.1,1)),new THREE.LineBasicMaterial({color:0xffd36e}));scene.add(outline);
 function focus(id:number){selectedId=id;stopWalking();const p=plotById(id);controls.target.set(p.x,0,p.z);camera.position.set(p.x+90,100,p.z+110);const w=[24,Math.sqrt(108)*4,Math.sqrt(216)*4][p.size];outline.position.set(p.x,.1,p.z);outline.scale.set(w+1,1,w*.77+1);controls.update();refreshDetails()}
 function refreshDetails(){const near=camera.position.distanceTo(controls.target)<2400?DISTRICT_PLOTS.filter(p=>Math.hypot(p.x-controls.target.x,p.z-controls.target.z)<500).sort((a,b)=>Math.hypot(a.x-controls.target.x,a.z-controls.target.z)-Math.hypot(b.x-controls.target.x,b.z-controls.target.z)).slice(0,96):[];const ids=new Set(near.map(p=>p.id));for(const [id,m]of details)if(!ids.has(id)){removeDetail(id,m)}for(const p of near)if(!details.has(p.id)){const m=createOilParcel(p.size,levels.get(p.id)??0);m.group.position.set(p.x,.01,p.z);m.group.userData.tokenId=p.id;scene.add(m.group);details.set(p.id,m);const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#172126';ctx.fillRect(0,0,256,64);ctx.fillStyle='#ffda91';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillText('PARCEL #'+p.id,128,44);const texture=new THREE.CanvasTexture(canvas);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));label.position.set(p.x,2,p.z+[24,Math.sqrt(108)*4,Math.sqrt(216)*4][p.size]*.385+2);label.scale.set(16,4,1);scene.add(label);labels.set(p.id,label)}}
 const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();let down={x:0,y:0};
 const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY}};
 const onUp=(e:PointerEvent)=>{if(player.active)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([bases,...[...details.values()].map(m=>m.group)],true)[0];if(!hit)return;let id:number|undefined;if(hit.object===bases&&hit.instanceId!==undefined)id=DISTRICT_PLOTS[hit.instanceId].id;else{let obj:THREE.Object3D=hit.object;while(obj.parent&&obj.userData.tokenId===undefined)obj=obj.parent;id=obj.userData.tokenId}if(id){focus(id);select(id)}};
 renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(host);resize();let frame=0;let last=0;const start=performance.now();let previous=start;
 function animate(){const now=performance.now();const dt=(now-previous)/1000;previous=now;if(player.active){player.update(dt);controls.target.copy(player.avatar.position)}if(now-last>300){refreshDetails();last=now}details.forEach(m=>m.animate((now-start)/1000));if(!player.active)controls.update();labels.forEach(label=>label.visible=!player.active);renderer.render(scene,camera);frame=requestAnimationFrame(animate)}focus(1);animate();
 return {focus,walk:()=>{const p=plotById(selectedId);const w=[24,Math.sqrt(108)*4,Math.sqrt(216)*4][p.size];controls.enabled=false;camera.near=.1;camera.updateProjectionMatrix();player.start(p.x-w/2-1,p.z);controls.target.copy(player.avatar.position);refreshDetails()},overview:()=>{stopWalking();controls.target.set(0,0,0);camera.position.set(0,DISTRICT_WIDTH*.9,DISTRICT_DEPTH*.85);controls.update();refreshDetails()},setLevel:(id:number,level:number)=>{levels.set(id,level);const m=details.get(id);if(m){removeDetail(id,m)}refreshDetails()},dispose:()=>{player.dispose();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);for(const [id,m]of details)removeDetail(id,m);geometry.dispose();bases.dispose();scene.children.forEach(o=>{if(o instanceof THREE.InstancedMesh&&o!==bases)o.dispose()});outline.geometry.dispose();(outline.material as THREE.Material).dispose();materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove()}};
}
