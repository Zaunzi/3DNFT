import {Multiplayer} from './multiplayer/client.ts';
import {GUEST_DOOD_ID} from './player/identity.ts';
import {updateFollowCamera} from './player/followCamera.ts';
import {chooseCharacter} from './player/selection.ts';
import {PlayerAvatar} from './player/avatar.ts';
import {HarvestRuntime} from './economy/runtime.ts';
import {costLabel} from './economy/model.ts';
import {WorldInputMode} from './player/inputMode.ts';
import * as THREE from 'three';
import { GENERATOR_VERSION, PARCEL_SIZE } from './world/constants.ts';
import { coordinateToTokenId, parseTokenId, parcelToWorld, tokenIdToCoordinate, worldToParcel } from './world/coordinates.ts';
import { WorldManager } from './world/worldManager.ts';
import { Player } from './player/player.ts';
import { createPlayerCamera } from './player/camera.ts';
import { createBackend } from './blockchain/backend.ts';
import { isParcelOwner } from './blockchain/ownership.ts';
import { ObjectRegistry } from './objects/registry.ts';
import { objectToWorldPosition } from './objects/model.ts';
import { PersistentObjectLayer } from './objects/persistentLayer.ts';
import { BuildController } from './build/buildController.ts';
import { ItemPortalRuntime } from './items/runtime.ts';
import { NFTRuntime } from './nfts/runtime.ts';
import { NFTRepresentationRegistry } from './nfts/rendering.ts';
import { MOCK_ITEMS, MOCK_NFT_COLLECTION } from './nfts/mock.ts';
import { getAddress, stringToHex } from 'viem';
import { locationFromURL } from './portals/location.ts';
import './style.css';
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<canvas aria-label="Interactive procedural parcel world"></canvas>
<header><div class="brand"><a href="./" aria-label="Doodverse home" style="color:inherit;pointer-events:auto;text-decoration:none">◈ DOODVERSE</a> <span>WORLD PARCELS / EXPERIMENT 001</span></div><div id="mode" class="badge">LOADING STATE</div></header>
<section class="location"><div class="eyebrow">YOU ARE HERE</div><h1>Parcel <span id="token">—</span></h1><p id="coordinate"></p><p id="owner">Resolving ownership…</p></section>
<section class="management"><button id="wallet-connect">Connect wallet</button><button id="wallet-disconnect" hidden>Disconnect</button><p id="wallet-state">Exploring anonymously</p><p id="permission">Connect wallet to manage this parcel</p><button id="build-toggle" disabled>Build [B]</button><button id="refresh-state">Refresh state</button><p id="state-message" role="status"></p></section>
<div id="toast" role="status"></div><div class="crosshair">+</div>
<section class="entry" id="entry"><div class="eyebrow">ONE WORLD. 5,000 PLACES.</div><h2>A place, not a picture.</h2><p>Walk beyond the border.<br>The next NFT is already here.</p><button id="enter">Enter world <span>↗</span></button><small>WASD move · Space jump · Mouse look · Shift sprint · Tab mouse · Esc release</small><p id="notice" role="status"></p></section>
<button id="resume-controls" hidden>Mouse released · Tab to resume movement</button>
<footer><span>DETERMINISTIC TERRAIN <b>/ V1</b></span><span>64 × 64 UNITS <b>·</b> N = −Z <b>·</b> E = +X</span><span id="heading">N</span></footer>`;
const el = (id: string) => document.getElementById(id)!;
async function start() {
  let token = parseTokenId(new URLSearchParams(location.search).get('tokenId'));
  const backend = await createBackend(import.meta.env), state = backend.world;
  locationFromURL(new URL(location.href), {chainId:backend.config.chainId,contractAddress:backend.config.land??'0x0000000000000000000000000000000000000000'});
  const chosenCharacter = await chooseCharacter(backend,token);
  token=chosenCharacter.parcelId;
  const entryURL=new URL(location.href);entryURL.searchParams.set('tokenId',String(token));history.replaceState(null,'',entryURL);
  const identity = await state.getWorld();
  if (![1,2].includes(identity.generatorVersion)) throw new Error('Unsupported generator version');
  el('mode').textContent = state.mode;
  const canvas = document.querySelector('canvas')!, renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb8c9c6); scene.fog = new THREE.Fog(0xb8c9c6, 55, 122);
  scene.add(new THREE.HemisphereLight(0xddece8, 0x69734b, 1.4));
  const sun = new THREE.DirectionalLight(0xffe9c2, 2.5); sun.position.set(-70, 110, 40); scene.add(sun);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.normalBias=.12;sun.shadow.bias=-.00015;scene.add(sun.target);
  const camera = createPlayerCamera(innerWidth / innerHeight);
  const spawn = parcelToWorld(tokenIdToCoordinate(token), PARCEL_SIZE / 2, PARCEL_SIZE / 2); camera.position.set(spawn.x, 0, spawn.z);
  const world = new WorldManager(scene, identity.seed); world.update(token);
  const anchor=camera.clone();anchor.rotation.order='YXZ';anchor.rotation.x=-.12;
  const player = new Player(anchor, canvas, identity.seed); player.update(0);
  let multiplayer:Multiplayer|undefined;
  let avatar = new PlayerAvatar(scene,chosenCharacter.asset?.tokenId??GUEST_DOOD_ID);
  let selectedAsset=chosenCharacter.asset;
  el('notice').textContent=`Playing as ${chosenCharacter.name}`;
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
  let experience:ItemPortalRuntime;
  const menusOpen=()=>!!builder?.active||!!assets?.open||!!assets?.placing||!!experience?.open;
  const inputMode=new WorldInputMode({
    render:mode=>{player.active=mode==='movement';el('entry').hidden=mode!=='welcome';el('resume-controls').hidden=mode!=='cursor';document.querySelector('.crosshair')!.classList.toggle('hidden-crosshair',mode!=='movement');},
    lock:()=>{
      (document.activeElement as HTMLElement|null)?.blur();
      try{void Promise.resolve(canvas.requestPointerLock()).catch(()=>inputMode.lockFailed());}catch{inputMode.lockFailed();}
    },
    unlock:()=>{if(player.controls.isLocked)player.controls.unlock();},
  });
  // Closing one panel can synchronously open another. Reconcile once so that
  // switching menus never briefly captures the mouse behind the next panel.
  const modalChanged=(active:boolean)=>{if(active)inputMode.menu(true);else queueMicrotask(()=>inputMode.menu(menusOpen()));};

  experience=new ItemPortalRuntime({openCharacters:()=>assets?.setOpen(true),backend,scene,camera,world,objects:layer,player,token:()=>token,canEdit:canBuild,builder:()=>builder,report,blocked:()=>!!assets?.open||!!assets?.placing,extraOccluders:()=>[...assets?.layer.roots()??[],],extraObstacles:async id=>{const s=await backend.nfts.snapshot(id);return [...s.containers,...s.doors,...s.attachments.flatMap(a=>a.location.kind==='parcel'?[a.location]:[])].map(t=>({...objectToWorldPosition(id,t),radius:1.5}));},modalChanged:active=>{if(active)assets?.cancelPlacement();if(active&&assets?.open)assets.setOpen(false);modalChanged(active);},commit(location,position,url){token=Number(location.tokenId);anchor.position.set(position.x,position.y,position.z);player.resetVertical();world.update(token);layer.sync(world.parcels.keys());assets?.sync();void enterParcel(token);history.pushState(null,'',url);}});
  assets=new NFTRuntime({backend,scene,camera,playerPosition:()=>anchor.position,canvas,canPlace:()=>canBuild(token),height:(x,z)=>layer.assetHeight(x,z),surfaces:()=>[...[...world.parcels.values()].map(p=>p.terrain),...layer.roots()],seed:identity.seed,ids:()=>world.parcels.keys(),token:()=>token,enabled:()=>player.active&&!builder?.active&&!experience.open,modal:active=>{if(active){if(builder?.active)builder.setActive(false);if(experience.open)experience.closePanels();}modalChanged(active);},report,changed:()=>{void refreshOwnership();void experience.refresh();},occluders:()=>[...[...world.parcels.values()].map(p=>p.terrain),...layer.roots(),...experience.layer.roots(),...experience.trinketLayer.roots()],gateway:import.meta.env.VITE_IPFS_GATEWAY??'https://ipfs.io/ipfs/',native:backend.config.mode==='mock'?MOCK_NFT_COLLECTION:import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS,items:import.meta.env.VITE_ATLAS_ITEMS_ADDRESS?getAddress(import.meta.env.VITE_ATLAS_ITEMS_ADDRESS):undefined});
  assets.sync();
  builder = new BuildController({ canvas, camera, scene, world, layer, registry, writer: backend.objects, cost:backend.economy?costLabel:undefined, modular:backend.supportsModular, lockedDoor:backend.supportsElevatedDoors?{createPreview:()=>new NFTRepresentationRegistry().door(),place:async(id,t)=>{if(backend.nfts.lockKeys&&backend.nfts.createKeyedDoor)await backend.nfts.createKeyedDoor(id,t);else await backend.nfts.createDoor(id,t,{kind:'erc1155',contractAddress:backend.config.mode==='mock'?MOCK_ITEMS:getAddress(import.meta.env.VITE_ATLAS_ITEMS_ADDRESS),tokenId:4n,minimum:1n,mode:'CHECK_ONLY'});await assets!.refreshWorld();}}:undefined, currentToken: () => token, canBuild, report,portals:backend.experience.enabled?experience.portals():undefined,
    onMode(active) {
      if(active){assets?.cancelPlacement();if(assets?.open)assets.setOpen(false);if(experience.open)experience.closePanels();}
      modalChanged(active);
      el('build-toggle').textContent = active ? 'Exit build [B]' : 'Build [B]';
    },
  });
  const harvesting=backend.economy?new HarvestRuntime({provider:backend.economy,world,camera,enabled:()=>player.active&&!menusOpen(),canHarvest:canBuild,token:()=>token,occluders:()=>[...layer.roots(),...experience.layer.roots(),...experience.trinketLayer.roots(),...assets!.layer.roots()],report,changed:()=>experience.inventory.refresh()}):undefined;
  player.ceiling=(x,z,feet)=>layer.ceilingHeight(x,z,feet);
  player.surface=(x,z,feet)=>layer.floorHeight(x,z,feet);
  player.obstructed=(position)=>layer.blocks(position.x,position.z,position.y-1.75)||!!assets?.blocks(position);
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
  let initialWalletNotification=true;
  const stopWallet = backend.wallet.subscribe(() => { if(!initialWalletNotification&&selectedAsset){avatar.dispose();avatar=new PlayerAvatar(scene,GUEST_DOOD_ID);selectedAsset=undefined;multiplayer?.useGuest();} initialWalletNotification=false; updatePermissions(); void refreshOwnership(); });
  el('wallet-connect').addEventListener('click', async () => { try { await backend.wallet.connect(); report(''); } catch (error) { report(error instanceof Error ? error.message : String(error)); } });
  el('wallet-disconnect').addEventListener('click', () => backend.wallet.disconnect());
  el('build-toggle').addEventListener('click', () => builder.toggle());
  async function validatePlayerIdentity(){const asset=selectedAsset;if(!asset)return;try{const owner=await backend.nfts.ownerOf(asset);if(selectedAsset===asset&&owner.toLowerCase()!==backend.wallet.snapshot.connectedAddress?.toLowerCase()){avatar.dispose();avatar=new PlayerAvatar(scene,GUEST_DOOD_ID);selectedAsset=undefined;multiplayer?.useGuest();report('Your selected CryptoDood left your wallet. Continuing as a guest.');}}catch{/* Keep play available during temporary RPC failure; retry next reconciliation. */}}
  const reconcile = () => { void validatePlayerIdentity();void refreshOwnership(); for (const id of world.parcels.keys()) void layer.refresh(id);void experience.refresh();void assets?.refreshWorld(); };
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
  inputMode.resume();
  el('enter').addEventListener('click',()=>inputMode.resume());
  el('resume-controls').addEventListener('click',()=>inputMode.resume());
  const inputEvents=new AbortController();
  document.addEventListener('pointerlockerror',()=>inputMode.lockFailed(),{signal:inputEvents.signal});
  window.addEventListener('keydown',event=>{
    if(event.repeat||menusOpen()||event.target instanceof Element&&event.target.matches('input,textarea,select,[contenteditable="true"]'))return;
    if(event.code==='Tab'&&inputMode.mode!=='welcome'){event.preventDefault();inputMode.toggleCursor();}
    if(event.code==='Escape')inputMode.release();
  },{capture:true,signal:inputEvents.signal});
  player.controls.addEventListener('lock',()=>inputMode.locked());
  player.controls.addEventListener('unlock',()=>inputMode.unlocked());
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }; window.addEventListener('resize', resize);
  let previous = performance.now(), hudTime = 0;
  const direction = new THREE.Vector3();
  await experience.initializeSpawn();
  anchor.position.copy(camera.position);
  const multiplayerURL=import.meta.env.VITE_MULTIPLAYER_URL||(import.meta.env.DEV?'ws://127.0.0.1:8787':'');
  multiplayer=multiplayerURL?new Multiplayer(scene,multiplayerURL,`${backend.config.mode}:${backend.config.chainId}:${(backend.config.land??'0x0000000000000000000000000000000000000000').toLowerCase()}:${identity.seed}:${identity.generatorVersion}`,selectedAsset&&backend.config.mode==='onchain'?async message=>{
    const ethereum=(window as Window & {ethereum?:{request:(request:{method:string;params:unknown[]})=>Promise<unknown>}}).ethereum;
    const address=backend.wallet.snapshot.connectedAddress,asset=selectedAsset;
    if(!ethereum||!address||!asset)throw Error('Guest session');
    const signature=await ethereum.request({method:'personal_sign',params:[stringToHex(message),address]});
    if(typeof signature!=='string'||backend.wallet.snapshot.connectedAddress!==address||selectedAsset!==asset)throw Error('Wallet changed');
    return {address,character:Number(asset.tokenId),signature};
  }:undefined,Number(chosenCharacter.asset?.tokenId??GUEST_DOOD_ID)):undefined;
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, 0.1); previous = now; player.update(dt);
    const c = worldToParcel(anchor.position.x, anchor.position.z), next = coordinateToTokenId(c.x, c.z)!;
    if (next !== token) { token = next; world.update(token); layer.sync(world.parcels.keys());experience.sync();assets?.sync(); void enterParcel(token); const url = new URL(location.href); url.searchParams.set('tokenId', String(token)); history.replaceState(null, '', url); }
    const cameraDistance=updateFollowCamera(camera,anchor,[...[...world.parcels.values()].map(p=>p.terrain),...layer.roots(),...assets!.layer.roots()]);
    layer.updateLighting(anchor.position);
    builder.update();experience.update();assets?.update();harvesting?.update();
    hudTime += dt;
    if (hudTime > 0.2) { camera.getWorldDirection(direction); const degrees = (Math.atan2(direction.x, -direction.z) * 180 / Math.PI + 360) % 360; el('heading').textContent = `${['N', 'E', 'S', 'W'][Math.round(degrees / 90) % 4]} ${degrees.toFixed(0)}°`; hudTime = 0; }
    sun.position.set(camera.position.x-40,camera.position.y+70,camera.position.z+25);sun.target.position.set(camera.position.x,camera.position.y-2,camera.position.z);
    avatar.update(anchor,dt,player.animation,cameraDistance);
    multiplayer?.update(anchor,dt,player.animation);
    renderer.render(scene, camera);
  });
  import.meta.hot?.dispose(() => { inputEvents.abort();multiplayer?.dispose();avatar.dispose();harvesting?.dispose();renderer.setAnimationLoop(null); stopWallet(); stopEvents?.();experience.dispose();assets?.dispose(); backend.wallet.dispose(); builder.dispose(); layer.dispose(); registry.dispose(); player.dispose(); world.dispose(); renderer.dispose(); window.removeEventListener('resize', resize); window.removeEventListener('focus', reconcile); clearTimeout(toastTimer); clearInterval(reconciliationTimer); });
}
void start().catch(error => { el('notice').textContent = error instanceof Error ? error.message : String(error); el('mode').textContent = 'UNAVAILABLE'; (el('enter') as HTMLButtonElement).disabled = true; });
