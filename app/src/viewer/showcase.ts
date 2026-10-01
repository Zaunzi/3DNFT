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
root.innerHTML = '<canvas aria-label="Animated diorama of a Doodverse parcel"></canvas><header><span>◈ DOODVERSE</span><a target="_blank" rel="noopener noreferrer">Open in Doodverse ↗</a></header><footer><div><h1></h1><p class="sector"></p></div><button type="button" aria-label="Pause camera orbit">Pause orbit</button></footer><p class="status" role="status">Loading parcel…</p>';
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
  root.querySelector('.sector')!.textContent = `SECTOR ${coordinate.x} / ${coordinate.z}`;
  const worldURL = new URL(location.href); worldURL.searchParams.delete('embed'); worldURL.searchParams.set('mode', 'world'); worldURL.searchParams.set('tokenId', String(id));
  root.querySelector('a')!.href = worldURL.href;
  const backend = await createBackend(import.meta.env);
  if (disposed) { backend.wallet.dispose(); return; }
  disposers.push(() => backend.wallet.dispose());
  const identity = await backend.world.getWorld();
  if (disposed) return;
  if (![1,2].includes(identity.generatorVersion)) throw new Error('Unsupported world generator.');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x182d2c);
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
  const itemLayer = new ExperienceLayer(scene,backend.experience,items,identity.seed,()=>report('items',true));
  const cache = new MetadataCache(a=>backend.nfts.tokenURI(a),import.meta.env.VITE_IPFS_GATEWAY??'https://ipfs.io/ipfs/');
  const nftLayer = new NFTLayer(scene,backend.nfts,new NFTRepresentationRegistry(backend.config.mode==='mock'?MOCK_NFT_COLLECTION:import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS),identity.seed,cache,()=>report('nfts',true));
  disposers.push(()=>{objectLayer.dispose();itemLayer.dispose();nftLayer.dispose();objects.dispose();items.dispose();});
  objectLayer.sync([id]); itemLayer.sync([id]); nftLayer.sync([id]);
  const canvas = root.querySelector('canvas')!, renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const camera = new THREE.PerspectiveCamera(38,1,0.1,1500), target = new THREE.Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'); let paused = reducedMotion.matches, angle = 0.7, last = 0;
  const button = root.querySelector('button')!;
  const label = () => { button.textContent = paused?'Resume orbit':'Pause orbit';button.setAttribute('aria-label',paused?'Resume camera orbit':'Pause camera orbit');button.setAttribute('aria-pressed',String(paused)); };
  label();button.onclick=()=>{paused=!paused;label();};
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
    if(now-fitAt>1000){bounds.setFromObject(parcel.group);for(const group of [...objectLayer.roots(),...itemLayer.roots(),...nftLayer.roots()])bounds.expandByObject(group);bounds.min.y=Math.min(bounds.min.y,bottom);bounds.getCenter(target);bounds.getBoundingSphere(sphere);const fov=Math.min(THREE.MathUtils.degToRad(camera.fov),2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*camera.aspect));distance=sphere.radius/Math.sin(fov/2)*1.12;fitAt=now;}
    camera.position.set(target.x+Math.cos(angle)*distance*0.78,target.y+distance*0.63,target.z+Math.sin(angle)*distance*0.78);camera.lookAt(target);objectLayer.updateLighting(camera.position);renderer.render(scene,camera);
  });
  disposers.push(()=>{renderer.setAnimationLoop(null);renderer.dispose();});
  const timer=window.setInterval(()=>{if(!document.hidden){void objectLayer.refresh(id);void itemLayer.refresh(id);void nftLayer.refresh(id);}},60000);disposers.push(()=>clearInterval(timer));
  status.textContent=issues.size?'Some parcel assets are unavailable. Open Doodverse to retry.':'';
}
void start().catch(()=>{if(!disposed)status.textContent='Parcel unavailable right now. Open in Doodverse to retry.';});
