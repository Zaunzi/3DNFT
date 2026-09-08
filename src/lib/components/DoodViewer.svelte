<script lang="ts">
 import {onMount} from 'svelte';
 import * as THREE from 'three';
 import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
 import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

 let {id = 1, clip = 'Idle'} = $props<{id?: number; clip?: string}>();
 let host: HTMLDivElement | undefined;
 let error = $state('');
 let ready = $state(false);
 let load: ((n: number) => void) | undefined;
 let play: ((name: string) => void) | undefined;

 $effect(() => {
  const n = id;
  if (!ready) return;
  load?.(n);
 });
 $effect(() => {
  const name = clip;
  if (!ready) return;
  play?.(name);
 });

 onMount(() => {
  if (!host) return;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8c7d1');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(2.5, 1.7, 5);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.15, 0);
  controls.enableDamping = true;
  controls.minDistance = 2;
  controls.maxDistance = 8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6172, 2));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-3, 5, 4);
  scene.add(key);

  let root: THREE.Group | undefined;
  let mixer: THREE.AnimationMixer | undefined;
  let actions: THREE.AnimationClip[] = [];
  let wanted = clip;
  let ticket = 0;
  let dead = false;

  function dispose(r: THREE.Group) {
   r.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
   });
  }

  function clipNamed(name: string) {
   const lower = name.toLowerCase();
   return (
    actions.find((a) => a.name === name) ??
    actions.find((a) => a.name.startsWith(name)) ??
    actions.find((a) => a.name.toLowerCase().includes(lower))
   );
  }

  play = (name) => {
   wanted = name;
   if (!mixer) return;
   mixer.stopAllAction();
   const a = clipNamed(name);
   if (!a) return;
   const action = mixer.clipAction(a);
   action.setLoop(['Idle', 'Walk', 'Run'].includes(name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
   action.clampWhenFinished = true;
   action.reset().play();
  };

  load = async (n) => {
   const t = ++ticket;
   error = '';
   const token = Math.max(1, Math.min(1000, Math.trunc(Number(n) || 1)));
   try {
    const g = await new GLTFLoader().loadAsync(`/cryptodoodz/models/${String(token).padStart(4, '0')}.glb`);
    if (dead || t !== ticket) {
     dispose(g.scene);
     return;
    }
    if (root) {
     scene.remove(root);
     dispose(root);
    }
    root = g.scene;
    scene.add(root);
    mixer = new THREE.AnimationMixer(root);
    actions = g.animations;
    play?.(wanted);
   } catch {
    error = 'Could not load this Dood. Try another.';
   }
  };

  ready = true;

  const ro = new ResizeObserver(() => {
   if (!host) return;
   const w = host.clientWidth;
   const h = host.clientHeight;
   renderer.setSize(w, h);
   camera.aspect = w / h;
   camera.updateProjectionMatrix();
  });
  ro.observe(host);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
   mixer?.update(Math.min(clock.getDelta(), 0.05));
   controls.update();
   renderer.render(scene, camera);
  });

  return () => {
   dead = true;
   ready = false;
   load = undefined;
   play = undefined;
   ro.disconnect();
   renderer.setAnimationLoop(null);
   if (root) dispose(root);
   controls.dispose();
   renderer.dispose();
   renderer.domElement.remove();
  };
 });
</script>

<div class="viewer" bind:this={host} aria-label="Interactive 3D CryptoDoodz preview"></div>
{#if error}<p role="status">{error}</p>{/if}

<style>
 .viewer { width: 100%; height: 520px; min-height: 320px; border-radius: 18px; overflow: hidden; }
 @media (max-width: 700px) { .viewer { height: 380px; } }
</style>
