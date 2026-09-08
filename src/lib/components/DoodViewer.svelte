<script lang="ts">
 import {onMount} from 'svelte';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
 let {id=1,clip='Idle'}=$props<{id?:number;clip?:string}>();let host:HTMLDivElement;let error=$state('');let load:((id:number)=>void)|undefined;let play:((name:string)=>void)|undefined;
 $effect(()=>{load?.(id)});$effect(()=>{play?.(clip)});
 onMount(()=>{const scene=new THREE.Scene();scene.background=new THREE.Color('#b8c7d1');const camera=new THREE.PerspectiveCamera(35,1,.01,100);camera.position.set(2.5,1.7,5);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.15,0);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=8;scene.add(new THREE.HemisphereLight(0xffffff,0x5a6172,2));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);
 let root:THREE.Group|undefined,mixer:THREE.AnimationMixer|undefined,actions:THREE.AnimationClip[]=[],ticket=0,dead=false;
 function dispose(r:THREE.Group){r.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}})}
 play=(name)=>{if(!mixer)return;mixer.stopAllAction();const a=actions.find(a=>a.name===name);if(a){const action=mixer.clipAction(a);action.setLoop(['Idle','Walk','Run'].includes(name)?THREE.LoopRepeat:THREE.LoopOnce,Infinity);action.clampWhenFinished=true;action.reset().play()}};
 load=async(n)=>{const t=++ticket;error='';try{const g=await new GLTFLoader().loadAsync(`/cryptodoodz/models/${String(n).padStart(4,'0')}.glb`);if(dead||t!==ticket){dispose(g.scene);return}if(root){scene.remove(root);dispose(root)}root=g.scene;scene.add(root);mixer=new THREE.AnimationMixer(root);actions=g.animations;play?.(clip)}catch{error='Could not load this Dood. Try another.'}};load(id);
 const ro=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});ro.observe(host);const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{mixer?.update(Math.min(clock.getDelta(),.05));controls.update();renderer.render(scene,camera)});
 return()=>{dead=true;load=undefined;play=undefined;ro.disconnect();renderer.setAnimationLoop(null);if(root)dispose(root);controls.dispose();renderer.dispose();renderer.domElement.remove()};
 });
</script>
<div class="viewer" bind:this={host} aria-label="Interactive 3D CryptoDoodz preview"></div>{#if error}<p role="status">{error}</p>{/if}
<style>.viewer{width:100%;height:520px;min-height:320px;border-radius:18px;overflow:hidden}@media(max-width:700px){.viewer{height:380px}}</style>
