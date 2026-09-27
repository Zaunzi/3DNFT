import * as THREE from 'three';
import { GENERATOR_VERSION, PARCEL_SIZE } from './world/constants.ts';
import { coordinateToTokenId, parseTokenId, parcelToWorld, tokenIdToCoordinate, worldToParcel } from './world/coordinates.ts';
import { WorldManager } from './world/worldManager.ts';
import { Player } from './player/player.ts';
import { createBackend } from './blockchain/backend.ts';
import { isParcelOwner } from './blockchain/ownership.ts';
import { ObjectRegistry } from './objects/registry.ts';
import { objectToWorldPosition } from './objects/model.ts';
import { PersistentObjectLayer } from './objects/persistentLayer.ts';
import { BuildController } from './build/buildController.ts';
import { updateDebug } from './debug/hud.ts';
import { ItemPortalRuntime } from './items/runtime.ts';
import { NFTRuntime } from './nfts/runtime.ts';
import { MOCK_NFT_COLLECTION } from './nfts/mock.ts';
import { getAddress } from 'viem';
import { locationFromURL } from './portals/location.ts';
import './style.css';
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<canvas aria-label="Interactive procedural parcel world"></canvas>
<header><div class="brand">◈ ATLAS <span>WORLD PARCELS / EXPERIMENT 001</span> <a href="./mint.html" style="color:inherit;pointer-events:auto">Mint assets ↗</a></div><div id="mode" class="badge">LOADING STATE</div></header>
<section class="location"><div class="eyebrow">YOU ARE HERE</div><h1>Parcel <span id="token">—</span></h1><p id="coordinate"></p><p id="owner">Resolving ownership…</p></section>
<section class="management"><button id="wallet-connect">Connect wallet</button><button id="wallet-disconnect" hidden>Disconnect</button><p id="wallet-state">Exploring anonymously</p><p id="permission">Connect wallet to manage this parcel</p><button id="build-toggle" disabled>Build [B]</button><button id="refresh-state">Refresh state</button><p id="state-message" role="status"></p></section>
<div id="toast" role="status"></div><div class="crosshair">+</div>
<section class="entry" id="entry"><div class="eyebrow">ONE WORLD. 5,000 PLACES.</div><h2>A place, not a picture.</h2><p>Walk beyond the border.<br>The next NFT is already here.</p><button id="enter">Enter world <span>↗</span></button><small>WASD move · Mouse look · Shift sprint · Esc release</small><p id="notice" role="status"></p></section>
<aside><label><input id="borders" type="checkbox" checked> Parcel borders</label><label><input id="debug-toggle" type="checkbox" checked> Diagnostics</label><pre id="debug"></pre></aside>
<footer><span>DETERMINISTIC TERRAIN <b>/ V1</b></span><span>64 × 64 UNITS <b>·</b> N = −Z <b>·</b> E = +X</span><span id="heading">N</span></footer>`;
const el = (id: string) => document.getElementById(id)!;
async function start() {
  let token = parseTokenId(new URLSearchParams(location.search).get('tokenId'));
  const backend = await createBackend(import.meta.env), state = backend.world;
  locationFromURL(new URL(location.href), {chainId:backend.config.chainId,contractAddress:backend.config.land??'0x0000000000000000000000000000000000000000'});
  const identity = await state.getWorld();
  if (identity.generatorVersion !== GENERATOR_VERSION) throw new Error('Unsupported generator version');
  el('mode').textContent = state.mode;
  const canvas = document.querySelector('canvas')!, renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb8c9c6); scene.fog = new THREE.Fog(0xb8c9c6, 55, 122);
  scene.add(new THREE.HemisphereLight(0xddece8, 0x69734b, 2));
  const sun = new THREE.DirectionalLight(0xffe9c2, 2.5); sun.position.set(-70, 110, 40); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 260);
  const spawn = parcelToWorld(tokenIdToCoordinate(token), PARCEL_SIZE / 2, PARCEL_SIZE / 2); camera.position.set(spawn.x, 0, spawn.z); camera.rotation.set(-0.09, -Math.PI / 2, 0);
  const world = new WorldManager(scene, identity.seed); world.update(token);
  const player = new Player(camera, canvas, identity.seed); player.update(0);
  let ownershipRequest = 0, toastTimer = 0;
  let parcelOwner: string | null = null;
  const report = (message: string) => { el('state-message').textContent = message; };
  const canBuild = (id: number) => id === token && backend.supportsBuild && isParcelOwner(parcelOwner, backend.wallet.snapshot, backend.config.chainId);
  const registry = new ObjectRegistry();
  const layer = new PersistentObjectLayer(scene, backend.objects, registry, identity.seed, (id, error) => {
    if (error) report(`Parcel #${id}: persistent state unavailable. ${error instanceof Error ? error.message : String(error)}`);
  });
  layer.sync(world.parcels.keys());
  let builder:BuildController;
  let assets:NFTRuntime|undefined;
  const modalChanged=(active:boolean)=>{player.active=false;if(player.controls.isLocked)player.controls.unlock();el('entry').hidden=active;document.querySelector('.crosshair')!.classList.toggle('hidden-crosshair',active);};
  const experience=new ItemPortalRuntime({backend,scene,camera,world,objects:layer,player,token:()=>token,canEdit:canBuild,builder:()=>builder,report,blocked:()=>!!assets?.open,extraOccluders:()=>assets?.layer.roots()??[],extraObstacles:async id=>{const s=await backend.nfts.snapshot(id);return [...s.containers,...s.doors,...s.attachments.flatMap(a=>a.location.kind==='parcel'?[a.location]:[])].map(t=>({...objectToWorldPosition(id,t),radius:1.5}));},modalChanged:active=>{if(active&&assets?.open)assets.setOpen(false);modalChanged(active);},commit(location,position,url){token=Number(location.tokenId);camera.position.set(position.x,position.y,position.z);world.update(token);layer.sync(world.parcels.keys());assets?.sync();void enterParcel(token);history.pushState(null,'',url);}});
  assets=new NFTRuntime({backend,scene,camera,seed:identity.seed,ids:()=>world.parcels.keys(),token:()=>token,enabled:()=>player.active&&!builder?.active&&!experience.inventory.open,modal:active=>{if(active){if(builder?.active)builder.setActive(false);if(experience.inventory.open)experience.inventory.setOpen(false);}modalChanged(active);},report,changed:()=>{void refreshOwnership();void experience.refresh();},occluders:()=>[...[...world.parcels.values()].map(p=>p.terrain),...layer.roots(),...experience.layer.roots()],gateway:import.meta.env.VITE_IPFS_GATEWAY??'https://ipfs.io/ipfs/',native:backend.config.mode==='mock'?MOCK_NFT_COLLECTION:import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS,items:import.meta.env.VITE_ATLAS_ITEMS_ADDRESS?getAddress(import.meta.env.VITE_ATLAS_ITEMS_ADDRESS):undefined});
  assets.sync();
  builder = new BuildController({ canvas, camera, scene, world, layer, registry, writer: backend.objects, currentToken: () => token, canBuild, report,portals:backend.experience.enabled?experience.portals():undefined,
    onMode(active) {
      if(active){if(assets?.open)assets.setOpen(false);if(experience.inventory.open)experience.inventory.setOpen(false);}
      player.active = false;
      if (player.controls.isLocked) player.controls.unlock();
      el('entry').hidden = active;
      el('build-toggle').textContent = active ? 'Exit build [B]' : 'Build [B]';
      document.querySelector('.crosshair')!.classList.toggle('hidden-crosshair', active);
    },
  });
  function updatePermissions() {
    const wallet = backend.wallet.snapshot;
    el('wallet-connect').hidden = wallet.isConnected;
    el('wallet-disconnect').hidden = !wallet.isConnected;
    el('wallet-connect').textContent = backend.config.mode === 'mock' ? 'Use mock owner' : 'Connect wallet';
    el('wallet-state').textContent = wallet.connectedAddress ? `${backend.config.mode === 'mock' ? 'Simulated' : 'Wallet'}: ${wallet.connectedAddress.slice(0, 6)}…${wallet.connectedAddress.slice(-4)} · Chain ${wallet.chainId}` : 'Exploring anonymously';
    el('permission').textContent = !backend.supportsBuild ? 'Read-only: configure the ParcelState contract' : !wallet.isConnected ? 'Connect wallet to manage this parcel' : wallet.chainId !== backend.config.chainId ? `Switch wallet to chain ${backend.config.chainId}` : canBuild(token) ? 'YOU OWN THIS PARCEL' : 'Only the parcel owner can build here';
    (el('build-toggle') as HTMLButtonElement).disabled = !canBuild(token);
    if (builder.active && !canBuild(token)) builder.setActive(false);
  }
  async function refreshOwnership() {
    const id = token, request = ++ownershipRequest;
    try {
      const parcel = await state.getParcel(id); if (request !== ownershipRequest || token !== id) return;
      parcelOwner = parcel.owner;
      const owner = parcel.owner ? `${parcel.owner.slice(0, 6)}…${parcel.owner.slice(-4)}` : 'Unminted';
      el('owner').textContent = `${backend.config.mode === 'mock' ? 'Mock owner' : 'Owner'}: ${owner}`; el('owner').title = parcel.owner ?? 'Unminted'; updatePermissions();
    } catch { if (request === ownershipRequest) { parcelOwner = null; el('owner').textContent = 'Ownership unavailable — RPC request failed'; updatePermissions(); } }
  }
  const stopWallet = backend.wallet.subscribe(() => { updatePermissions(); void refreshOwnership(); });
  el('wallet-connect').addEventListener('click', async () => { try { await backend.wallet.connect(); report(''); } catch (error) { report(error instanceof Error ? error.message : String(error)); } });
  el('wallet-disconnect').addEventListener('click', () => backend.wallet.disconnect());
  el('build-toggle').addEventListener('click', () => builder.toggle());
  const reconcile = () => { void refreshOwnership(); for (const id of world.parcels.keys()) void layer.refresh(id);void experience.refresh();void assets?.refreshWorld(); };
  el('refresh-state').addEventListener('click', reconcile);
  const stopEvents = backend.objects.subscribe?.(id => { const value = Number(id); void layer.refresh(value); if (value === token) void refreshOwnership(); }, () => report('Live updates unavailable. Refresh state to retry; periodic reconciliation remains active.'));
  const reconciliationTimer = window.setInterval(reconcile, 30000);
  window.addEventListener('focus', reconcile);
  async function enterParcel(id: number) {
    const c = tokenIdToCoordinate(id);
    parcelOwner = null; updatePermissions();
    el('token').textContent = `#${id.toString().padStart(4, '0')}`; el('coordinate').textContent = `SECTOR ${c.x} / ${c.z} · SHARED WORLD`;
    el('owner').textContent = 'Resolving ownership…'; el('toast').textContent = `ENTERING PARCEL #${id}`; el('toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el('toast').classList.remove('visible'), 3500);
    await refreshOwnership();
  }
  void enterParcel(token);
  el('enter').addEventListener('click', () => { player.controls.lock(); });
  document.addEventListener('pointerlockerror', () => {
    if (builder.active||assets?.open||experience.inventory.open) return;
    player.active = true; el('entry').hidden = true;
    el('toast').textContent = 'DRAG TO LOOK · WASD TO MOVE · ESC TO PAUSE'; el('toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el('toast').classList.remove('visible'), 6000);
  });
  window.addEventListener('keydown', event => { if (event.code === 'Escape' && !builder.active&&!assets?.open&&!experience.inventory.open) { player.active = false; el('entry').hidden = false; } });
  player.controls.addEventListener('lock', () => { el('entry').hidden = true; });
  player.controls.addEventListener('unlock', () => { el('entry').hidden = builder.active||!!assets?.open||experience.inventory.open; });
  el('borders').addEventListener('change', e => world.setBorders((e.target as HTMLInputElement).checked));
  el('debug-toggle').addEventListener('change', e => { el('debug').hidden = !(e.target as HTMLInputElement).checked; });
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }; window.addEventListener('resize', resize);
  let previous = performance.now(), hudTime = 0, frames = 0, elapsed = 0;
  const direction = new THREE.Vector3();
  await experience.initializeSpawn();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, 0.1); previous = now; const priorPosition=camera.position.clone();player.update(dt);if(assets?.blocks(camera.position))camera.position.copy(priorPosition);
    const c = worldToParcel(camera.position.x, camera.position.z), next = coordinateToTokenId(c.x, c.z)!;
    if (next !== token) { token = next; world.update(token); layer.sync(world.parcels.keys());experience.sync();assets?.sync(); void enterParcel(token); const url = new URL(location.href); url.searchParams.set('tokenId', String(token)); history.replaceState(null, '', url); }
    builder.update();experience.update();assets?.update();
    frames++; elapsed += dt; hudTime += dt;
    if (hudTime > 0.2) { updateDebug(el('debug'), token, camera.position.x, camera.position.z, identity.seed, [...world.parcels.keys()].sort((a,b) => a-b), frames / elapsed); camera.getWorldDirection(direction); const degrees = (Math.atan2(direction.x, -direction.z) * 180 / Math.PI + 360) % 360; el('heading').textContent = `${['N', 'E', 'S', 'W'][Math.round(degrees / 90) % 4]} ${degrees.toFixed(0)}°`; hudTime = 0; frames = 0; elapsed = 0; }
    if(el('debug').textContent&&!el('debug').textContent!.includes('ATTACHED721'))el('debug').textContent+=experience.debug()+assets?.debug();
    renderer.render(scene, camera);
  });
  import.meta.hot?.dispose(() => { renderer.setAnimationLoop(null); stopWallet(); stopEvents?.();experience.dispose();assets?.dispose(); backend.wallet.dispose(); builder.dispose(); layer.dispose(); registry.dispose(); player.dispose(); world.dispose(); renderer.dispose(); window.removeEventListener('resize', resize); window.removeEventListener('focus', reconcile); clearTimeout(toastTimer); clearInterval(reconciliationTimer); });
}
void start().catch(error => { el('notice').textContent = error instanceof Error ? error.message : String(error); el('mode').textContent = 'UNAVAILABLE'; (el('enter') as HTMLButtonElement).disabled = true; });
