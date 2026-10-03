import {dragOrbit, zoomOrbit} from './orbit.ts';
import {TrinketRegistry} from '../trinkets/rendering.ts';
import * as THREE from 'three';
import { createBackend } from '../blockchain/backend.ts';
import { parseTokenId, tokenIdToCoordinate, parcelToWorld } from '../world/coordinates.ts';
import { createParcel } from '../world/parcel.ts';
import { PARCEL_SIZE, SEGMENTS, GENERATOR_VERSION } from '../world/constants.ts';
import { getTerrainHeight } from '../world/terrain.ts';
import { ObjectRegistry } from '../objects/registry.ts';
import { PersistentObjectLayer } from '../objects/persistentLayer.ts';
import { ExperienceLayer, ExperienceRegistry } from '../items/rendering.ts';
import { NFTLayer, NFTRepresentationRegistry } from '../nfts/rendering.ts';
import { MetadataCache } from '../nfts/metadata.ts';
import { MOCK_NFT_COLLECTION } from '../nfts/mock.ts';
import './showcase.css';

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = '<canvas aria-label="Animated diorama of a Doodverse parcel"></canvas><header><span>◈ DOODVERSE</span><a target="_blank" rel="noopener noreferrer">Open in Doodverse ↗</a></header><footer><div><h1></h1><p class="sector"></p></div><nav class="camera-controls" aria-label="Parcel camera"><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset" aria-label="Reset zoom">Fit</button><button type="button" class="orbit-toggle" aria-label="Pause camera orbit">Pause orbit</button></nav></footer><p class="status" role="status">Loading parcel…</p>';
const hero = new URLSearchParams(location.search).get('hero') === '1';
if(hero) document.body.classList.add('hero-preview');
const status = root.querySelector<HTMLElement>('.status')!;
const disposers: (() => void)[] = [];
let disposed = false;
function dispose() { if (disposed) return; disposed = true; for (const fn of disposers.reverse()) fn(); }
import.meta.hot?.dispose(dispose);
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });

async function start() {
  const id = parseTokenId(new URLSearchParams(location.search).get('tokenId'));
  const coordinate = tokenIdToCoordinate(id), origin = parcelToWorld(coordinate);
  root.querySelector('h1')!.textContent = `Parcel #${id}`;
  root.querySelector('.sector')!.textContent = `SECTOR ${coordinate.x} / ${coordinate.z} · DRAG TO ORBIT`;
  const worldURL = new URL(location.href); worldURL.searchParams.delete('embed'); worldURL.searchParams.delete('hero'); worldURL.searchParams.set('mode', 'world'); worldURL.searchParams.set('tokenId', String(id));
  root.querySelector('a')!.href = worldURL.href;
  const backend = await createBackend(import.meta.env);
  if (disposed) { backend.wallet.dispose(); return; }
  disposers.push(() => backend.wallet.dispose());
  const identity = await backend.world.getWorld();
  if (disposed) return;
  if (![1,2].includes(identity.generatorVersion)) throw new Error('Unsupported world generator.');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(hero ? 0x132f27 : 0x182d2c);
  scene.add(new THREE.HemisphereLight(0xe8f1dc, 0x635143, 2.4));
  const sun = new THREE.DirectionalLight(0xffe5b9, 3); sun.position.set(origin.x + 40, 100, origin.z + 20); scene.add(sun);
  const parcel = createParcel(id, identity.seed); parcel.border.visible = false; scene.add(parcel.group); disposers.push(() => parcel.dispose());
  // A presentation-only terrain skirt gives the globally generated parcel a cutaway base.
  // It does not change any terrain heights or canonical coordinates.
  const initialBounds = new THREE.Box3().setFromObject(parcel.group), bottom = initialBounds.min.y - 7;
  const vertices: number[] = [], step = PARCEL_SIZE / SEGMENTS;
  for (let side = 0; side < 4; side++) for (let i = 0; i < SEGMENTS; i++) {
    const edge = (t: number) => side === 0 ? [t, 0] : side === 1 ? [PARCEL_SIZE, t] : side === 2 ? [PARCEL_SIZE - t, PARCEL_SIZE] : [0, PARCEL_SIZE - t];
    const [x,z] = edge(i * step), [nx,nz] = edge((i+1) * step);
    const y = getTerrainHeight(origin.x+x, origin.z+z, identity.seed), ny = getTerrainHeight(origin.x+nx, origin.z+nz, identity.seed);
    vertices.push(x,y,z, x,bottom,z, nx,ny,nz, nx,ny,nz, x,bottom,z, nx,bottom,nz);
  }
  const skirtGeometry = new THREE.BufferGeometry(); skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); skirtGeometry.computeVertexNormals();
  const skirtMaterial = new THREE.MeshStandardMaterial({color:0x645744,roughness:1,side:THREE.DoubleSide});
  const skirt = new THREE.Mesh(skirtGeometry, skirtMaterial); skirt.position.set(origin.x,0,origin.z); scene.add(skirt);
  disposers.push(() => { skirtGeometry.dispose(); skirtMaterial.dispose(); });
  const issues = new Set<string>();
  const report = (label: string, failed: boolean) => { if (disposed) return; failed ? issues.add(label) : issues.delete(label); status.textContent = issues.size ? 'Some parcel assets are unavailable. Open Doodverse to retry.' : ''; };
  const objects = new ObjectRegistry(), items = new ExperienceRegistry();
  const objectLayer = new PersistentObjectLayer(scene,backend.objects,objects,identity.seed,(_,error)=>report('objects',!!error));
  const trinkets=new TrinketRegistry();
  const trinketLayer=new ExperienceLayer(scene,backend.trinkets,trinkets,identity.seed,()=>report('trinkets',true),'trinket');
  const itemLayer = new ExperienceLayer(scene,backend.experience,items,identity.seed,()=>report('items',true));
  const cache = new MetadataCache(a=>backend.nfts.tokenURI(a),import.meta.env.VITE_IPFS_GATEWAY??'https://ipfs.io/ipfs/');
  const nftLayer = new NFTLayer(scene,backend.nfts,new NFTRepresentationRegistry(backend.config.mode==='mock'?MOCK_NFT_COLLECTION:import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS),identity.seed,cache,()=>report('nfts',true));
  disposers.push(()=>{objectLayer.dispose();trinketLayer.dispose();trinkets.dispose();itemLayer.dispose();nftLayer.dispose();objects.dispose();items.dispose();});
  trinketLayer.sync([id]);objectLayer.sync([id]); itemLayer.sync([id]); nftLayer.sync([id]);
  const canvas = root.querySelector('canvas')!, renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const camera = new THREE.PerspectiveCamera(38,1,0.1,1500), target = new THREE.Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'); let paused = reducedMotion.matches, angle = 0.7, elevation = Math.atan2(0.63,0.78), last = 0;
  const button = root.querySelector<HTMLButtonElement>('.orbit-toggle')!;
  const label = () => { button.textContent = paused?'Resume orbit':'Pause orbit';button.setAttribute('aria-label',paused?'Resume camera orbit':'Pause camera orbit');button.setAttribute('aria-pressed',String(paused)); };
  label();button.onclick=()=>{paused=!paused;label();};
  let pointer:number|null=null, pointerX=0, pointerY=0;
  const events=new AbortController();disposers.push(()=>events.abort());
  let zoom = 1;
  const zoomIn = root.querySelector<HTMLButtonElement>('[data-zoom="in"]')!;
  const zoomOut = root.querySelector<HTMLButtonElement>('[data-zoom="out"]')!;
  const setZoom = (value: number) => {
    zoom = value;
    zoomIn.disabled = zoom <= .25; zoomOut.disabled = zoom >= 2;
    canvas.setAttribute('aria-label', `Parcel diorama. Drag to orbit; scroll to zoom. Zoom ${Math.round(100 / zoom)}%.`);
  };
  setZoom(1);
  zoomIn.addEventListener('click', () => setZoom(zoomOrbit(zoom, -120)), {signal:events.signal});
  zoomOut.addEventListener('click', () => setZoom(zoomOrbit(zoom, 120)), {signal:events.signal});
  root.querySelector('[data-zoom="reset"]')!.addEventListener('click', () => setZoom(1), {signal:events.signal});
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    setZoom(zoomOrbit(zoom, pixels));
  }, {passive:false, signal:events.signal});
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||pointer!==null)return;
    pointer=event.pointerId;pointerX=event.clientX;pointerY=event.clientY;
    canvas.setPointerCapture(pointer);canvas.classList.add('dragging');
    paused=true;label();
  },{signal:events.signal});
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointer)return;
    const next=dragOrbit(angle,elevation,event.clientX-pointerX,event.clientY-pointerY);
    angle=next.angle;elevation=next.elevation;pointerX=event.clientX;pointerY=event.clientY;
  },{signal:events.signal});
  const endDrag=(event:PointerEvent)=>{if(event.pointerId===pointer){pointer=null;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}};
  for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)canvas.addEventListener(type,endDrag,{signal:events.signal});

  const reduce=()=>{paused=reducedMotion.matches;label();};reducedMotion.addEventListener('change',reduce);disposers.push(()=>reducedMotion.removeEventListener('change',reduce));
  const resize = () => { camera.aspect=innerWidth/Math.max(1,innerHeight);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight); };
  resize();window.addEventListener('resize',resize);disposers.push(()=>window.removeEventListener('resize',resize));
  // Fit the complete parcel plus attachments, not the surrounding world. No player
  // or interaction controllers are constructed by this presentation entry point.
  const bounds = new THREE.Box3(), sphere = new THREE.Sphere();
  let distance=160, fitAt=-Infinity;
  renderer.setAnimationLoop(now=>{
    if(document.hidden){last=now;return;} if(now-last<1000/30)return;
    const dt=Math.min((now-last)/1000,0.1);last=now;if(!paused)angle+=dt*0.055;
    if(now-fitAt>1000){bounds.setFromObject(parcel.group);for(const group of [...objectLayer.roots(),...itemLayer.roots(),...trinketLayer.roots(),...nftLayer.roots()])bounds.expandByObject(group);bounds.min.y=Math.min(bounds.min.y,bottom);bounds.getCenter(target);bounds.getBoundingSphere(sphere);const fov=Math.min(THREE.MathUtils.degToRad(camera.fov),2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*camera.aspect));distance=sphere.radius/Math.sin(fov/2)*1.12;fitAt=now;}
    const viewDistance=distance*zoom;
    camera.position.set(target.x+Math.cos(angle)*viewDistance*Math.cos(elevation),target.y+viewDistance*Math.sin(elevation),target.z+Math.sin(angle)*viewDistance*Math.cos(elevation));camera.lookAt(target);objectLayer.updateLighting(camera.position);renderer.render(scene,camera);
  });
  disposers.push(()=>{renderer.setAnimationLoop(null);renderer.dispose();});
  const timer=window.setInterval(()=>{if(!document.hidden){void trinketLayer.refresh(id);void objectLayer.refresh(id);void itemLayer.refresh(id);void nftLayer.refresh(id);}},60000);disposers.push(()=>clearInterval(timer));
  status.textContent=issues.size?'Some parcel assets are unavailable. Open Doodverse to retry.':'';
}
void start().catch(()=>{if(!disposed)status.textContent='Parcel unavailable right now. Open in Doodverse to retry.';});
