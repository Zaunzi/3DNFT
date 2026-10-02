import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { CHARACTER_CLIPS, type CharacterClip } from './model.ts';

/** A disposable instance: changing collections or IDs also retires late model loads. */
export function characterPreview(host: HTMLElement, id: number, initialClip: CharacterClip, onReady: () => void) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-label', `Character #${id}. Drag to rotate; scroll to zoom.`);
  const note = document.createElement('p');
  note.setAttribute('role', 'status');
  note.textContent = 'Loading character…';
  host.replaceChildren(renderer.domElement, note);
  host.dataset.ready = 'loading';
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777b82, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  fill.position.set(3, 2, -3);
  scene.add(fill);
  let disposed = false;
  let root: THREE.Group | undefined;
  let mixer: THREE.AnimationMixer | undefined;
  let wanted = initialClip;
  let clips: THREE.AnimationClip[] = [];
  let size: THREE.Vector3 | undefined;
  const release = (model: THREE.Object3D) => {
    const textures = new Set<THREE.Texture>();
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
    });
    textures.forEach(texture => texture.dispose());
  };
  function play(clip: CharacterClip) {
    wanted = clip;
    if (!mixer) return;
    const animation = clips.find(value => value.name === clip);
    if (!animation) return;
    mixer.stopAllAction();
    mixer.clipAction(animation).reset().setLoop(THREE.LoopRepeat, Infinity).play();
    host.dataset.animation = clip;
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    if (size) {
      // Match the collection viewer's framing, reserving room for Jump and tall hats.
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const distance = Math.max((size.y + .85) / (2 * Math.tan(halfFov)), (size.x + .5) / (2 * Math.tan(halfFov) * camera.aspect));
      const direction = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.minDistance = distance * .65;
      controls.maxDistance = distance * 2;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    controls.update();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  void new GLTFLoader().loadAsync(`/cryptodoodz/models/${String(id).padStart(4, '0')}.glb`).then(gltf => {
    if (disposed) { release(gltf.scene); return; }
    if (!CHARACTER_CLIPS.every(clip => gltf.animations.some(animation => animation.name === clip))) {
      release(gltf.scene);
      throw new Error('Missing character animations');
    }
    root = gltf.scene;
    clips = gltf.animations;
    scene.add(root);
    const bounds = new THREE.Box3().setFromObject(root);
    size = bounds.getSize(new THREE.Vector3());
    controls.target.set(0, (bounds.min.y + bounds.max.y) / 2 + .12, 0);
    camera.position.copy(controls.target).add(new THREE.Vector3(.25, .1, 1));
    mixer = new THREE.AnimationMixer(root);
    resize();
    play(wanted);
    note.remove();
    host.dataset.ready = 'true';
    onReady();
  }).catch(() => {
    if (disposed) return;
    note.textContent = 'Unable to load this preview. Try another character or reload.';
    host.dataset.ready = 'error';
  });
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = Math.min(clock.getDelta(), .05);
    if (document.hidden) return;
    mixer?.update(delta);
    controls.update();
    renderer.render(scene, camera);
  });
  return { play, dispose() {
    disposed = true;
    observer.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    mixer?.stopAllAction();
    if (root) { mixer?.uncacheRoot(root); release(root); }
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    note.remove();
    delete host.dataset.ready;
    delete host.dataset.animation;
  } };
}
