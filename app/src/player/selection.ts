import {parseTokenId} from '../world/coordinates.ts';
import {GUEST_DOOD_ID} from './identity.ts';
import type {createBackend} from '../blockchain/backend.ts';
import type {NFTAsset} from '../nfts/model.ts';
import {characterPreview} from '../mint/characterPreview.ts';
import './selection.css';
export interface PlayerIdentity { asset?:NFTAsset; name:string; }
/** Choosing an avatar is presentation only: no approvals or custody changes. */
export function chooseCharacter(backend:Awaited<ReturnType<typeof createBackend>>,initialParcel:number):Promise<PlayerIdentity & {parcelId:number}> {
 return new Promise(resolve=>{
  const screen=document.createElement('section');screen.className='character-selection';screen.setAttribute('aria-label','Choose your character');
  screen.innerHTML=`<div class="dood-selection"><a href="./">◈ DOODVERSE</a><p class="eyebrow">YOUR DOOD. YOUR ADVENTURE.</p><h1>Who’s stepping in?</h1><p>Bring your CryptoDood, or explore with a free guest. No NFT leaves your wallet.</p><div class="dood-selection-grid"><div class="dood-preview"></div><div><h2>Choose your character</h2><button class="dood-connect">Connect wallet</button><p class="dood-status" role="status"></p><div class="dood-options"></div><label class="dood-spawn-label" for="dood-owned">Your parcels</label><select id="dood-owned" disabled><option value="">Connect wallet to load your parcels</option></select><p class="dood-parcels-status" role="status"></p><label class="dood-spawn-label" for="dood-spawn">Spawn parcel</label><input id="dood-spawn" type="number" min="0" max="4999" step="1" required aria-describedby="dood-spawn-help"><small id="dood-spawn-help">Choose a parcel from 0 to 4,999. You don’t need to own it to visit.</small><button class="dood-enter">Enter world ↗</button><small>Third-person · WASD move · Shift sprint · Space jump · Mouse look</small></div></div></div>`;
  document.body.append(screen);
  const host=screen.querySelector<HTMLElement>('.dood-preview')!,options=screen.querySelector<HTMLElement>('.dood-options')!,status=screen.querySelector<HTMLElement>('.dood-status')!,enter=screen.querySelector<HTMLButtonElement>('.dood-enter')!,connect=screen.querySelector<HTMLButtonElement>('.dood-connect')!;
  const spawn=screen.querySelector<HTMLInputElement>('#dood-spawn')!;spawn.value=String(initialParcel);
  const owned=screen.querySelector<HTMLSelectElement>('#dood-owned')!,parcelStatus=screen.querySelector<HTMLElement>('.dood-parcels-status')!;
  owned.onchange=()=>{if(owned.value!=='')spawn.value=owned.value;};
  spawn.addEventListener('input',()=>{owned.value=spawn.value;});
  async function loadParcels(request:number){
   const wallet=backend.wallet.snapshot;owned.replaceChildren(new Option('Enter a parcel number below',''));owned.disabled=true;
   if(!wallet.connectedAddress){parcelStatus.textContent='Connect your wallet to choose an owned parcel.';return;}
   if(wallet.chainId!==backend.config.chainId){parcelStatus.textContent=`Switch to chain ${backend.config.chainId} to load your parcels.`;return;}
   parcelStatus.textContent='Loading your parcels…';
   try{const ids=await backend.world.ownedParcels?.(wallet.connectedAddress)??[];if(closed||request!==generation)return;ids.forEach(id=>owned.add(new Option(`Parcel #${id}`,String(id))));owned.disabled=ids.length===0;owned.value=ids.includes(Number(spawn.value))?spawn.value:'';parcelStatus.textContent=ids.length?`${ids.length} owned parcels. Choose one, or visit any parcel by number.`:'No owned parcels found. You can still visit by number.';}catch{if(!closed&&request===generation)parcelStatus.textContent='Could not load parcels. Refresh your wallet list to retry, or enter a number.';}
  }
  let selection:PlayerIdentity={name:'Guest Dood'},preview:ReturnType<typeof characterPreview>|undefined,generation=0,closed=false;
  function select(identity:PlayerIdentity,button:HTMLButtonElement){selection=identity;options.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));preview?.dispose();preview=characterPreview(host,Number(identity.asset?.tokenId??GUEST_DOOD_ID),'Idle',()=>{});}
  function option(identity:PlayerIdentity){const b=document.createElement('button');b.textContent=identity.name;b.onclick=()=>select(identity,b);options.append(b);return b;}
  async function refresh(){const request=++generation;void loadParcels(request);options.replaceChildren();select({name:'Guest Dood'},option({name:'Guest Dood'}));const wallet=backend.wallet.snapshot;connect.textContent=wallet.isConnected?'Refresh my wallet':backend.config.mode==='mock'?'Use mock owner':'Connect wallet';status.textContent='Guest appearance is free for everyone.';
   if(!wallet.connectedAddress)return;if(wallet.chainId!==backend.config.chainId){status.textContent=`Switch your wallet to chain ${backend.config.chainId} to load your Doodz.`;return;}
   status.textContent='Finding your wallet-owned CryptoDoodz…';
   try{const assets=await backend.nfts.ownedCharacters?.(wallet.connectedAddress)??[];if(closed||request!==generation)return;assets.forEach(asset=>option({asset,name:`CryptoDoodz #${asset.tokenId}`}));status.textContent=assets.length?`${assets.length} wallet-owned Doodz. Pick one below.`:'No wallet-held CryptoDoodz found. You can still play as a guest.';}catch{if(request===generation&&!closed)status.textContent='Could not load ownership. Retry, or enter as a guest.';}
  }
  connect.onclick=()=>{if(backend.wallet.snapshot.isConnected)void refresh();else void backend.wallet.connect().catch(()=>{status.textContent='Wallet connection was not completed. Guest entry is available.';});};
  const unsubscribe=backend.wallet.subscribe(()=>void refresh());
  enter.onclick=async()=>{if(!spawn.reportValidity())return;const parcelId=parseTokenId(spawn.value);enter.disabled=true;const identity=selection;try{if(identity.asset){const wallet=backend.wallet.snapshot;const owner=await backend.nfts.ownerOf(identity.asset);if(!wallet.connectedAddress||wallet.chainId!==backend.config.chainId||owner.toLowerCase()!==wallet.connectedAddress.toLowerCase()||wallet.connectedAddress!==backend.wallet.snapshot.connectedAddress)throw new Error('Ownership changed. Please choose again.');}closed=true;++generation;unsubscribe();preview?.dispose();screen.remove();resolve({...identity,parcelId});}catch{status.textContent='Ownership could not be confirmed. Refresh your Doodz or choose Guest.';enter.disabled=false;}};
 });
}
