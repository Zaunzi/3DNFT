import { createPublicClient, createWalletClient, custom, http, parseAbi, getAddress, decodeEventLog, zeroAddress, type Address } from 'viem';
import { base } from 'viem/chains';
import { InjectedWallet, type InjectedProvider } from '../blockchain/wallet.ts';
import { mintInput, parcelMintQuantity, type MintKind as AllMintKind } from './model.ts';
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
<div class="mint-layout"><section class="preview" aria-label="Asset preview"><div id="preview-media"></div><div class="preview-caption"><span id="preview-name">Parcel #1</span><span id="preview-note">Example parcel · minted IDs are assigned automatically</span></div></section>
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
const abi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)', 'function PUBLIC_MINT() view returns(bool)', 'function mintedBy(address) view returns(uint256)', 'function mint(uint256)', 'function owner() view returns(address)', 'function mint(address,uint256)', 'function mint(address,uint256,uint256)']);
let busy = false, ready = false, publicParcels = true;
let minted: bigint | undefined;
async function refreshAllowance() {
  const account = wallet.snapshot.connectedAddress; minted = undefined;
  if (publicParcels && account && addresses?.parcel) {
    try { const value = await client.readContract({address:addresses.parcel,abi,functionName:"mintedBy",args:[account]}); if(wallet.snapshot.connectedAddress === account) minted=value; } catch { /* Simulation remains authoritative when quota reads fail. */ }
  }
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
  const publicMint = k === 'parcel' && publicParcels;
  el('mint-policy').textContent=publicMint?'Free public mint · Five per wallet, lifetime · Network gas still applies. IDs are assigned automatically.':'This collection uses owner-only minting.';
  el('token-id').setAttribute('aria-label',k==='character'?'Character ID':'Token ID');
  el('id-label').hidden = publicMint || (k === 'trinket'); el('item-label').hidden = (k !== 'trinket'); el('quantity-label').hidden = !publicMint && (k !== 'trinket');
  el('help').textContent = k === 'parcel' ? (publicParcels?'Parcels are assigned in sequence, starting at #0. Transferring a parcel does not restore your mint allowance.':'This is the older owner-minted parcel deployment. Choose an unused ID from 0–4999.') : k === 'character' ? 'A native character NFT you can attach to a parcel or store in a container.' : 'Collect an instrument, place it on your parcel, and click to play it in the world.';
  el('authority').textContent = publicMint ? (minted===undefined?'Public mint':`${minted}/5 minted by this wallet · ${5n-minted} remaining`) : owners.has(k) ? `Mint authority: ${owners.get(k)}${account && account.toLowerCase() !== owners.get(k)!.toLowerCase() ? ' — connected wallet is not the owner.' : ''}` : '';
  el('contract').textContent = addresses?.[k] ? `Contract: ${addresses[k]}` : 'This collection is not configured yet.';
  const submit = el<HTMLButtonElement>('submit'); submit.textContent = busy ? 'Transaction in progress…' : `Mint ${k}`;
  submit.disabled = busy || !ready || wallet.snapshot.chainId !== base.id || !account || (!publicMint && account.toLowerCase() !== owners.get(k)?.toLowerCase()) || (publicMint && minted !== undefined && minted >= 5n);
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
el('kind').addEventListener('change', () => { el<HTMLInputElement>('token-id').value = '1'; populateItems(); render(); preview(); });
el('connect').onclick = async () => { try { await wallet.connect(); } catch (e) { el('status').textContent = message(e); } };
el('switch').onclick = async () => { try { if (!provider) throw new Error('Connect an injected wallet.'); await createWalletClient({ transport: custom(provider) }).switchChain({ id: base.id }); await wallet.refresh(); } catch (e) { el('status').textContent = message(e); } };
el('mint').onsubmit = async event => {
  event.preventDefault(); if (busy || !ready) return;
  let submitted = false;
  try {
    const k = kind(), publicMint = k === 'parcel' && publicParcels;
    const quantity = publicMint ? parcelMintQuantity(input('quantity')) : 1n;
    const value = mintInput(k, wallet.snapshot.connectedAddress??'', publicMint ? '0' : input((k === 'trinket') ? 'item' : 'token-id'), input('quantity'));
    const address = addresses[k]; if (!address) throw new Error('This collection is not configured yet.');
    busy = true; render(); el('result').replaceChildren(); el('status').textContent = 'Checking mint permissions and simulating transaction…';
    const signer = await wallet.forChain(base.id);
    if(signer.account.address.toLowerCase()!==value.recipient.toLowerCase()) throw new Error('Wallet changed. Review and submit again.');
    if (!publicMint) {
    const owner = await client.readContract({ address, abi, functionName: 'owner' });
    owners.set(k, owner); if (owner.toLowerCase() !== signer.account.address.toLowerCase()) throw new Error('Only the current contract owner can mint.');
    }
    const args = publicMint ? [quantity] as const : (k === 'trinket') ? [value.recipient, value.id, value.quantity] as const : [value.recipient, value.id] as const;
    const simulation = await client.simulateContract({ address, abi, functionName: 'mint', args, account: signer.account });
    const fresh = await wallet.forChain(base.id); if (fresh.account.address !== signer.account.address) throw new Error('Wallet changed. Review and submit again.');
    el('status').textContent = publicMint ? `Confirm minting ${quantity} automatically assigned parcel(s). Mint price: 0 ETH, plus network gas.` : `Confirm minting ${k} #${value.id} to ${value.recipient} in your wallet.`;
    const hash = await fresh.writeContract({ ...simulation.request, chain: base }); submitted = true;
    const link = document.createElement('a'); link.href = `https://basescan.org/tx/${hash}`; link.textContent = 'View transaction on Basescan'; link.target = '_blank'; link.rel = 'noopener noreferrer'; el('result').append(link);
    el('status').textContent = 'Submitted. Waiting for confirmation…';
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== 'success') throw new Error('Transaction reverted. No asset was minted.');
    el('status').textContent = publicMint ? `Mint confirmed: ${quantity} parcel(s) to your wallet. See the transaction for assigned IDs.` : `Mint confirmed: ${k} #${value.id}${(k === 'trinket') ? ` × ${value.quantity}` : ''} → ${value.recipient}`;
    if (publicMint) {
      const ids: bigint[] = [];
      for(const log of receipt.logs) {
        if(log.address.toLowerCase()!==address.toLowerCase()) continue;
        try { const event=decodeEventLog({abi,eventName:'Transfer',data:log.data,topics:log.topics}); if(event.args.from===zeroAddress) ids.push(event.args.tokenId); } catch { /* Ignore non-mint logs. */ }
      }
      el('status').textContent=`Mint confirmed: ${ids.map(id=>`#${id}`).join(', ')} → ${value.recipient}`;
      for(const id of ids) { const open=document.createElement('a');open.href=`/?tokenId=${id}`;open.textContent=`Open parcel #${id}`;el('result').append(document.createElement('br'),open); }
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
    ready = true; void refreshAllowance(); el('setup').textContent = 'Base mainnet · deployed contracts verified for mint authority';
  } catch (e) { el('setup').textContent = message(e); } render();
}
void init();

function preview() {
  const media=el('preview-media'), k=kind(); media.replaceChildren();
  if(k==='parcel') {
    const frame=document.createElement('iframe');frame.src='/?mode=showcase&tokenId=1';frame.title='Interactive example of parcel 1';frame.loading='lazy';media.append(frame);
    el('preview-name').textContent='Parcel #1';el('preview-note').textContent='Live example · your parcel ID is assigned automatically';return;
  }
  const id=k==='character'?input('token-id'):input('item');
  const valid=/^[0-9]+$/.test(id)&&BigInt(id)>=1n&&BigInt(id)<=BigInt(k==='character'?1000:5);
  el('preview-name').textContent=k==='character'?`Character #${id}`:TRINKETS.find(t=>String(t.id)===id)?.name??'Trinket';
  el('preview-note').textContent=k==='character'?'CryptoDoodz · Doodverse Characters':TRINKETS.find(t=>String(t.id)===id)?.kind??'';
  if(!valid){media.textContent='Choose a valid ID to preview this asset.';return;}
  const image=document.createElement('img');image.alt=el('preview-name').textContent!;
  image.src=k==='character'?`https://3dnft.vercel.app/cryptodoodz/images/${String(Number(id)).padStart(4,'0')}.png`:`https://3dnft.vercel.app/trinkets/images/${Number(id)}.svg`;
  image.onerror=()=>{if(image.parentElement===media){media.replaceChildren();media.textContent='Preview unavailable. You can still review the collection details.';}};
  media.append(image);
}
el('item').addEventListener('change',preview);
el('token-id').addEventListener('input',preview);
preview();
