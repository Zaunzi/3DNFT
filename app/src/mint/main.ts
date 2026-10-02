import { createPublicClient, createWalletClient, custom, http, parseAbi, getAddress, decodeEventLog, zeroAddress, type Address } from 'viem';
import { base } from 'viem/chains';
import { InjectedWallet, type InjectedProvider } from '../blockchain/wallet.ts';
import { mintInput, parcelMintQuantity, CHARACTER_CLIPS, type CharacterClip, type MintKind as AllMintKind } from './model.ts';
import { TRINKETS } from '../items/trinkets.ts';
import './style.css';
type MintKind = Exclude<AllMintKind, 'item'>;

document.querySelector('#app')!.innerHTML = `<nav><a class="wordmark" href="/">◈ DOODVERSE</a><a href="/?tokenId=1">Enter world ↗</a></nav>
<header><p class="eyebrow">THE COLLECTIONS / BASE</p><h1>A place. A personality.<br>A little noise.</h1><p>Claim your corner of Doodverse. Bring a character. Make it your own.</p></header>
<div class="collection-buttons" role="group" aria-label="Choose a collection">
<button type="button" data-kind="parcel" aria-pressed="true"><span>01 / LAND</span><strong>Parcels</strong><small>5,000 places. One shared world.</small></button>
<button type="button" data-kind="character" aria-pressed="false"><span>02 / PEOPLE</span><strong>Characters</strong><small>Meet your next world resident.</small></button>
<button type="button" data-kind="trinket" aria-pressed="false"><span>03 / PLAY</span><strong>Trinkets</strong><small>Five instruments. Your soundtrack.</small></button>
</div>
<div class="mint-layout"><section class="preview" aria-label="Asset preview"><div id="preview-media"></div>
<div id="character-controls" hidden><div class="character-navigation"><button type="button" id="previous-character" aria-label="Previous character">←</button><label for="preview-character-id">Preview #<input id="preview-character-id" type="number" min="1" max="5000" step="1" value="1" aria-label="Preview character number"></label><button type="button" id="next-character" aria-label="Next character">→</button></div><div class="character-animations" role="group" aria-label="Character animation">${CHARACTER_CLIPS.map(clip=>`<button type="button" data-clip="${clip}" aria-pressed="${clip==='Idle'}" disabled>${clip}</button>`).join('')}</div></div>
<div class="preview-caption"><span id="preview-name">Parcel #1</span><span id="preview-note">Example parcel · minted IDs are assigned automatically</span></div></section>
<div class="mint-details"><section class="wallet"><div class="wallet-top"><span class="eyebrow">YOUR WALLET</span><button id="connect">Connect wallet</button><button id="switch" hidden>Switch to Base</button></div><p id="wallet">Connect to mint directly to your wallet.</p><p id="setup" role="status">Checking deployment…</p></section>
<form id="mint"><p class="eyebrow">MAKE IT YOURS</p><h2 id="form-title">Mint Parcels</h2><label hidden>Asset<select id="kind"><option value="parcel">Parcel</option><option value="character">Character</option><option value="trinket">Trinket</option></select></label>
<p id="help"></p><label id="id-label">Character ID<input id="token-id" value="1" inputmode="numeric"></label>
<label id="item-label" hidden>Instrument<select id="item"></select></label><label id="quantity-label">Quantity<input id="quantity" value="1" inputmode="numeric" required></label>
<p id="authority"></p><button id="submit" type="submit" disabled>Mint parcel</button><p class="muted" id="mint-policy"></p><details><summary>Contract details</summary><p id="contract"></p></details></form>
<section class="transaction"><p class="eyebrow">TRANSACTION</p><p id="status" role="status">Your mint will appear here.</p><div id="result"></div></section></div></div>
<footer><p>Made to exist in your world.</p><span>Place characters and instruments from your world inventory. Parcel Items are no longer minted here. Wood and stone harvesting is currently available in mock mode.</span><a href="/?tokenId=1">Explore Doodverse ↗</a></footer>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id).value.trim();
const provider = (window as Window & { ethereum?: InjectedProvider }).ethereum;
const wallet = new InjectedWallet(provider);
const abi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)', 'function PUBLIC_MINT() view returns(bool)', 'function mintedBy(address) view returns(uint256)', 'function minted(address,uint256) view returns(bool)', 'function mint(uint256)', 'function owner() view returns(address)', 'function mint(address,uint256)', 'function mint(address,uint256,uint256)']);
let busy = false, ready = false, publicParcels = true;
let publicCharacters=false, characterMinted:bigint|undefined;
let publicTrinkets=false, trinketClaimed:boolean|undefined;
let minted: bigint | undefined;
async function refreshAllowance() {
  const account = wallet.snapshot.connectedAddress; minted = undefined;characterMinted=undefined;trinketClaimed=undefined;const selected=input('item');
  if (publicParcels && account && addresses?.parcel) {
    try { const value = await client.readContract({address:addresses.parcel,abi,functionName:"mintedBy",args:[account]}); if(wallet.snapshot.connectedAddress === account) minted=value; } catch { /* Simulation remains authoritative when quota reads fail. */ }
  }
  if(publicCharacters&&account&&addresses?.character){try{const count=await client.readContract({address:addresses.character,abi,functionName:'mintedBy',args:[account]});if(wallet.snapshot.connectedAddress===account)characterMinted=count;}catch{}}
  if(publicTrinkets&&account&&addresses?.trinket){try{const claimed=await client.readContract({address:addresses.trinket,abi,functionName:'minted',args:[account,BigInt(selected)]});if(wallet.snapshot.connectedAddress===account&&input('item')===selected)trinketClaimed=claimed;}catch{/* Fail closed until allowance can be verified. */}}
  render();
}
let addresses: Partial<Record<MintKind, Address>>;
const owners = new Map<MintKind, Address>();
const client = createPublicClient({ chain: base, transport: http(import.meta.env.VITE_RPC_URL || 'https://base-rpc.publicnode.com'), batch: { multicall: { wait: 40 } } });
const kind = () => input('kind') as MintKind;
const message = (error: unknown) => error instanceof Error ? ('shortMessage' in error ? String(error.shortMessage) : error.message) : 'Request failed. Please retry.';
function render() {
  const k = kind(), account = wallet.snapshot.connectedAddress;
  const labels: Record<MintKind, string> = {parcel:'Parcels',trinket:'Trinkets',character:'Characters'};
  el('form-title').textContent = `Mint ${labels[k]}`;
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.kind === k));
    button.disabled = busy;
  });
  el('connect').textContent=account?'Wallet connected':'Connect wallet';
  el('wallet').textContent = account ? `${account} · chain ${wallet.snapshot.chainId}` : 'Not connected';
  el('switch').hidden = !account || wallet.snapshot.chainId === base.id;
  const publicMint = ((k === 'parcel' && publicParcels)||(k==='character'&&publicCharacters));
  el('mint-policy').textContent=publicMint?'Free public mint · Five per wallet, lifetime · Network gas still applies. IDs are assigned automatically.':'This collection uses owner-only minting.';
  const used=k==='character'?characterMinted:minted;
  el('token-id').setAttribute('aria-label',k==='character'?'Character ID':'Token ID');
  el('id-label').hidden = publicMint || k === 'character' || (k === 'trinket'); el('item-label').hidden = (k !== 'trinket'); el('quantity-label').hidden = !publicMint && k!=='character';
  el('help').textContent = k === 'parcel' ? (publicParcels?'Parcels are assigned in sequence, starting at #0. Transferring a parcel does not restore your mint allowance.':'This is the older owner-minted parcel deployment. Choose an unused ID from 0–4999.') : k === 'character' ? 'A native character NFT you can attach to a parcel or store in a container.' : 'Collect an instrument, place it on your parcel, and click to play it in the world.';
  el('authority').textContent = publicMint ? (used===undefined?'Public mint':`${used}/5 minted by this wallet · ${5n-used} remaining`) : owners.has(k) ? `Mint authority: ${owners.get(k)}${account && account.toLowerCase() !== owners.get(k)!.toLowerCase() ? ' — connected wallet is not the owner.' : ''}` : '';
  if(k==='trinket'){el('mint-policy').textContent='Free public mint · One of each instrument per wallet, lifetime · Network gas applies.';el('authority').textContent=!publicTrinkets?'Public mint is awaiting the new contract deployment.':!account?'Connect your wallet to check your allowance.':trinketClaimed===undefined?'Checking instrument allowance…':trinketClaimed?'Already minted by this wallet.':'Available: one mint of this instrument.';}
  if(k==='character'){el('help').textContent='5,000 CryptoDoodz. Character IDs are assigned automatically starting at #1.';el('mint-policy').textContent='Free public mint · Five per wallet, lifetime · Network gas applies.';if(!publicCharacters)el('authority').textContent='Public character mint is awaiting the new contract deployment.';}
  el('contract').textContent = addresses?.[k] ? `Contract: ${addresses[k]}` : 'This collection is not configured yet.';
  const submit = el<HTMLButtonElement>('submit'); submit.textContent = busy ? 'Transaction in progress…' : `Mint ${k}`;
  submit.disabled = busy || !ready || wallet.snapshot.chainId !== base.id || !account || (!publicMint && k!=='trinket' && account.toLowerCase() !== owners.get(k)?.toLowerCase()) || (k==='trinket'&&(!publicTrinkets||trinketClaimed!==false)) || (publicMint && used !== undefined && used >= 5n) || (k==='character'&&!publicCharacters);
  for (const id of ['kind','token-id','item','quantity','connect','switch']) (el(id) as HTMLInputElement).disabled = busy;
}
function populateItems() { el('item').replaceChildren(); for (const item of TRINKETS) { const option = document.createElement('option'); option.value = String(item.id); option.textContent = `${item.name} (#${item.id})`; el('item').append(option); } }
populateItems();
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
  button.onclick = () => {
    if (busy) return;
    el<HTMLSelectElement>('kind').value = button.dataset.kind!;
    el('kind').dispatchEvent(new Event('change'));
  };
});
wallet.subscribe(() => {render(); void refreshAllowance();});
el('kind').addEventListener('change', () => { el<HTMLInputElement>('token-id').value = '1'; populateItems(); render(); preview(); void refreshAllowance(); });
el('connect').onclick = async () => { try { await wallet.connect(); } catch (e) { el('status').textContent = message(e); } };
el('switch').onclick = async () => { try { if (!provider) throw new Error('Connect an injected wallet.'); await createWalletClient({ transport: custom(provider) }).switchChain({ id: base.id }); await wallet.refresh(); } catch (e) { el('status').textContent = message(e); } };
el('mint').onsubmit = async event => {
  event.preventDefault(); if (busy || !ready) return;
  let submitted = false;
  try {
    const k = kind(), publicMint = ((k === 'parcel' && publicParcels)||(k==='character'&&publicCharacters));
    const quantity = publicMint ? parcelMintQuantity(input('quantity')) : 1n;
    const value = mintInput(k, wallet.snapshot.connectedAddress??'', publicMint ? '0' : input((k === 'trinket') ? 'item' : 'token-id'), k==='trinket'?'1':input('quantity'));
    const address = addresses[k]; if (!address) throw new Error('This collection is not configured yet.');
    busy = true; render(); el('result').replaceChildren(); el('status').textContent = 'Checking mint permissions and simulating transaction…';
    const signer = await wallet.forChain(base.id);
    if(signer.account.address.toLowerCase()!==value.recipient.toLowerCase()) throw new Error('Wallet changed. Review and submit again.');
    if(k==='character'&&!publicCharacters)throw new Error('Public character mint requires the new contract deployment.');
    if(k==='trinket'&&!publicTrinkets)throw new Error('Public trinket mint requires the new contract deployment.');
    if (!publicMint && k!=='trinket') {
    const owner = await client.readContract({ address, abi, functionName: 'owner' });
    owners.set(k, owner); if (owner.toLowerCase() !== signer.account.address.toLowerCase()) throw new Error('Only the current contract owner can mint.');
    }
    const args = publicMint ? [quantity] as const : (k === 'trinket') ? [value.id] as const : [value.recipient, value.id] as const;
    const simulation = await client.simulateContract({ address, abi, functionName: 'mint', args, account: signer.account });
    const fresh = await wallet.forChain(base.id); if (fresh.account.address !== signer.account.address) throw new Error('Wallet changed. Review and submit again.');
    el('status').textContent = publicMint ? `Confirm minting ${quantity} automatically assigned ${k}(s). Mint price: 0 ETH, plus network gas.` : `Confirm minting ${k} #${value.id} to ${value.recipient} in your wallet.`;
    const hash = await fresh.writeContract({ ...simulation.request, chain: base }); submitted = true;
    const link = document.createElement('a'); link.href = `https://basescan.org/tx/${hash}`; link.textContent = 'View transaction on Basescan'; link.target = '_blank'; link.rel = 'noopener noreferrer'; el('result').append(link);
    el('status').textContent = 'Submitted. Waiting for confirmation…';
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== 'success') throw new Error('Transaction reverted. No asset was minted.');
    el('status').textContent = publicMint ? `Mint confirmed: ${quantity} ${k}(s) to your wallet. See the transaction for assigned IDs.` : `Mint confirmed: ${k} #${value.id}${(k === 'trinket') ? ` × ${value.quantity}` : ''} → ${value.recipient}`;
    if (publicMint) {
      const ids: bigint[] = [];
      for(const log of receipt.logs) {
        if(log.address.toLowerCase()!==address.toLowerCase()) continue;
        try { const event=decodeEventLog({abi,eventName:'Transfer',data:log.data,topics:log.topics}); if(event.args.from===zeroAddress) ids.push(event.args.tokenId); } catch { /* Ignore non-mint logs. */ }
      }
      el('status').textContent=`Mint confirmed: ${ids.map(id=>`#${id}`).join(', ')} → ${value.recipient}`;
      for(const id of k==='parcel'?ids:[]) { const open=document.createElement('a');open.href=`/?tokenId=${id}`;open.textContent=`Open parcel #${id}`;el('result').append(document.createElement('br'),open); }
    }
    if (k === 'parcel' && !publicMint) { const open = document.createElement('a'); open.href = `/?tokenId=${value.id}`; open.textContent = 'Open this parcel'; el('result').append(document.createElement('br'), open); }
  } catch (e) { el('status').textContent = `${message(e)}${submitted ? ' Check the linked transaction before trying another mint.' : ''}`; }
  finally { busy = false; await refreshAllowance(); render(); }
};
async function init() {
  try {
    if (import.meta.env.VITE_WORLD_STATE_MODE !== 'onchain' || Number(import.meta.env.VITE_CHAIN_ID) !== base.id) throw new Error('Minting requires the Base production configuration. Local mock mode does not mint real assets.');
    addresses = { parcel: getAddress(import.meta.env.VITE_WORLD_PARCEL_NFT_ADDRESS), character: getAddress(import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS) };
    if (import.meta.env.VITE_DOODVERSE_TRINKETS_ADDRESS) addresses.trinket = getAddress(import.meta.env.VITE_DOODVERSE_TRINKETS_ADDRESS);
    if (await client.getChainId() !== base.id) throw new Error('RPC is not Base mainnet.');
    await Promise.all((Object.keys(addresses) as MintKind[]).map(async k => owners.set(k, await client.readContract({ address: addresses[k]!, abi, functionName: 'owner' }))));
    try { publicParcels=await client.readContract({address:addresses.parcel!,abi,functionName:'PUBLIC_MINT'}); } catch { publicParcels=false; }
    if(addresses.trinket){try{publicTrinkets=await client.readContract({address:addresses.trinket,abi,functionName:'PUBLIC_MINT'});}catch{publicTrinkets=false;}}
    if(addresses.character){try{publicCharacters=await client.readContract({address:addresses.character,abi,functionName:'PUBLIC_MINT'});}catch{publicCharacters=false;}}
    ready = true; void refreshAllowance(); el('setup').textContent = 'Base mainnet · deployed contracts verified for mint authority';
  } catch (e) { el('setup').textContent = message(e); } render();
}
void init();

let disposePreview:(()=>void)|undefined;let previewVersion=0;
let characterId=1, characterClip:CharacterClip='Idle';
let characterInputTimer:number|undefined;
let playCharacterClip:((clip:CharacterClip)=>void)|undefined;
const animationButtons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-clip]'));
function preview() {
  window.clearTimeout(characterInputTimer);
  disposePreview?.();disposePreview=undefined;playCharacterClip=undefined;const version=++previewVersion;
  const media=el('preview-media'), k=kind(); media.replaceChildren();
  el('character-controls').hidden=k!=='character';
  el<HTMLInputElement>('preview-character-id').value=String(characterId);
  el<HTMLButtonElement>('previous-character').disabled=characterId===1;
  el<HTMLButtonElement>('next-character').disabled=characterId===5000;
  animationButtons.forEach(button=>{button.disabled=true;button.setAttribute('aria-pressed',String(button.dataset.clip===characterClip));});
  if(k==='parcel') {
    const frame=document.createElement('iframe');frame.src='/?mode=showcase&tokenId=1';frame.title='Interactive example of parcel 1';frame.loading='lazy';media.append(frame);
    el('preview-name').textContent='Parcel #1';el('preview-note').textContent='Live example · your parcel ID is assigned automatically';return;
  }
  const id=k==='character'?String(characterId):input('item');
  const valid=/^[0-9]+$/.test(id)&&BigInt(id)>=1n&&BigInt(id)<=BigInt(k==='character'?5000:5);
  el('preview-name').textContent=k==='character'?`Character #${id}`:TRINKETS.find(t=>String(t.id)===id)?.name??'Trinket';
  el('preview-note').textContent=k==='character'?'Drag to rotate · Preview choice does not select the NFT you mint.':TRINKETS.find(t=>String(t.id)===id)?.kind??'';
  if(!valid){media.textContent='Choose a valid ID to preview this asset.';return;}
  if(k==='trinket'){
    media.textContent='Loading 3D instrument…';el('preview-note').textContent+=' · Drag to rotate';
    void import('./trinketPreview.ts').then(module=>{if(version!==previewVersion)return;try{disposePreview=module.trinketPreview(media,Number(id));}catch{media.textContent='3D preview unavailable on this device.';}}).catch(()=>{if(version===previewVersion)media.textContent='Unable to load 3D preview.';});return;
  }
  media.textContent='Loading character…';
  void import('./characterPreview.ts').then(module=>{
    if(version!==previewVersion)return;
    const player=module.characterPreview(media,characterId,characterClip,()=>{
      if(version===previewVersion)animationButtons.forEach(button=>{button.disabled=false;});
    });
    disposePreview=player.dispose;playCharacterClip=player.play;
  }).catch(()=>{if(version===previewVersion)media.textContent='3D character preview unavailable on this device.';});
}
function browseCharacter(id:number){characterId=Math.max(1,Math.min(5000,id));preview();}
el('previous-character').onclick=()=>browseCharacter(characterId-1);
el('next-character').onclick=()=>browseCharacter(characterId+1);
el('preview-character-id').addEventListener('input',()=>{
  window.clearTimeout(characterInputTimer);
  const field=el<HTMLInputElement>('preview-character-id');
  if(!field.value.trim()||!field.checkValidity())return;
  const id=field.valueAsNumber;
  characterInputTimer=window.setTimeout(()=>{if(kind()==='character')browseCharacter(id);},300);
});
el('preview-character-id').addEventListener('change',()=>{
  window.clearTimeout(characterInputTimer);
  const field=el<HTMLInputElement>('preview-character-id');
  if(!field.value.trim()||!field.checkValidity()){field.reportValidity();field.value=String(characterId);return;}
  browseCharacter(field.valueAsNumber);
});
animationButtons.forEach(button=>{button.onclick=()=>{
  characterClip=button.dataset.clip as CharacterClip;
  playCharacterClip?.(characterClip);
  animationButtons.forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
};});
addEventListener('pagehide',()=>{++previewVersion;disposePreview?.();disposePreview=undefined;});
addEventListener('pageshow',event=>{if(event.persisted)preview();});
el('item').addEventListener('change',()=>{preview();void refreshAllowance();});
el('token-id').addEventListener('input',preview);
preview();
