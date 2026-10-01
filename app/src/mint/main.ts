import { createPublicClient, createWalletClient, custom, http, parseAbi, getAddress, decodeEventLog, zeroAddress, type Address } from 'viem';
import { base } from 'viem/chains';
import { InjectedWallet, type InjectedProvider } from '../blockchain/wallet.ts';
import { ITEM_DEFINITIONS } from '../items/definitions.ts';
import { mintInput, parcelMintQuantity, type MintKind } from './model.ts';
import { TRINKETS } from '../items/trinkets.ts';
import './style.css';

document.querySelector('#app')!.innerHTML = `<nav><a href="/">◈ DOODVERSE / WORLD PARCELS</a><span>BASE MAINNET</span></nav>
<header><p class="eyebrow">MINT DOODVERSE</p><h1>Mint your world.</h1><p>Create parcels, characters and items, then bring them into Doodverse.</p></header>
<section class="wallet"><button id="connect">Connect wallet</button><button id="switch" hidden>Switch to Base</button><p id="wallet">Not connected</p><p id="setup" role="status">Checking deployment…</p></section>
<section aria-label="Choose a collection"><h2>What would you like to mint?</h2><div class="collection-buttons">
<button type="button" data-kind="parcel" aria-pressed="true">Mint Parcels</button>
<button type="button" data-kind="trinket" aria-pressed="false">Mint Trinkets</button>
<button type="button" data-kind="item" aria-pressed="false">Mint Parcel Items</button>
<button type="button" data-kind="character" aria-pressed="false">Mint Characters</button>
</div><p class="muted">Choose a collection, then review the details below. Trinkets, parcel items and characters require the collection owner's wallet.</p></section>
<form id="mint"><h2 id="form-title">Mint Parcels</h2><label hidden>Asset<select id="kind"><option value="parcel">Parcel · ERC-721</option><option value="character">Character · ERC-721</option><option value="item">Doodverse Parcel Items · ERC-1155</option><option value="trinket">Doodverse Trinkets · ERC-1155</option></select></label>
<p id="help"></p><label>Recipient address<input id="recipient" placeholder="0x…" required autocomplete="off"></label><button id="self" type="button">Use my wallet</button>
<label id="id-label">Token ID<input id="token-id" value="742" inputmode="numeric" required></label>
<label id="item-label" hidden>Item<select id="item"></select></label><label id="quantity-label" hidden>Quantity<input id="quantity" value="1" inputmode="numeric"></label>
<p id="authority"></p><p id="contract"></p><button id="submit" type="submit" disabled>Mint parcel</button><p class="muted" id="mint-policy"></p></form>
<section><h2>Transaction</h2><p id="status" role="status">Choose an asset to begin.</p><div id="result"></div></section>
<section><h2>Try it in the world</h2><ol><li>Mint a parcel, then use its confirmation link to open your assigned location and connect that wallet.</li><li>Mint a character (start with #1) and some items to the same wallet.</li><li>Use Inventory to place items, or NFTs / Containers to approve and attach a character. For other character IDs, enter the character contract and token ID in that panel.</li></ol><p class="muted">Buildings and portals are parcel state, not separate mintable NFTs. Characters use CryptoDoodz metadata. You can also attach your own external ERC-721s through the world UI.</p></section>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id).value.trim();
const provider = (window as Window & { ethereum?: InjectedProvider }).ethereum;
const wallet = new InjectedWallet(provider);
const abi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)', 'function PUBLIC_MINT() view returns(bool)', 'function mintedBy(address) view returns(uint256)', 'function mint(uint256)', 'function owner() view returns(address)', 'function mint(address,uint256)', 'function mint(address,uint256,uint256)']);
let busy = false, ready = false, publicParcels = false;
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
  const labels: Record<MintKind, string> = {parcel:'Parcels',trinket:'Trinkets',item:'Parcel Items',character:'Characters'};
  el('form-title').textContent = `Mint ${labels[k]}`;
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.kind === k));
    button.disabled = busy;
  });
  el('wallet').textContent = account ? `${account} · chain ${wallet.snapshot.chainId}` : 'Not connected';
  el('switch').hidden = !account || wallet.snapshot.chainId === base.id;
  const publicMint = k === 'parcel' && publicParcels;
  el<HTMLInputElement>('recipient').readOnly = publicMint;
  if(publicMint) el<HTMLInputElement>('recipient').value=account??'';
  el('mint-policy').textContent=publicMint?'Free public mint · Five per wallet, lifetime · Network gas still applies. IDs are assigned automatically.':'This collection uses owner-only minting.';
  el('id-label').hidden = publicMint || (k === 'item' || k === 'trinket'); el('item-label').hidden = (k !== 'item' && k !== 'trinket'); el('quantity-label').hidden = !publicMint && (k !== 'item' && k !== 'trinket');
  el('help').textContent = k === 'parcel' ? (publicParcels?'Parcels are assigned in sequence, starting at #0. Transferring a parcel does not restore your mint allowance.':'This is the older owner-minted parcel deployment. Choose an unused ID from 0–4999.') : k === 'character' ? 'A native character NFT you can attach to a parcel or store in a container.' : k === 'trinket' ? 'Five collectible instruments hosted on the legacy site. Trinkets are a separate collection; parcel-item placement and containers currently accept utilities only.' : 'Stone, wood, crystal, keys, lanterns and portal cores. Items can be placed through your world inventory.';
  el('authority').textContent = publicMint ? (minted===undefined?'Public mint':`${minted}/5 minted by this wallet · ${5n-minted} remaining`) : owners.has(k) ? `Mint authority: ${owners.get(k)}${account && account.toLowerCase() !== owners.get(k)!.toLowerCase() ? ' — connected wallet is not the owner.' : ''}` : '';
  el('contract').textContent = addresses?.[k] ? `Contract: ${addresses[k]}` : 'This collection is not configured yet.';
  const submit = el<HTMLButtonElement>('submit'); submit.textContent = busy ? 'Transaction in progress…' : `Mint ${k}`;
  submit.disabled = busy || !ready || wallet.snapshot.chainId !== base.id || !account || (!publicMint && account.toLowerCase() !== owners.get(k)?.toLowerCase()) || (publicMint && minted !== undefined && minted >= 5n);
  for (const id of ['kind','recipient','token-id','item','quantity','self','connect','switch']) (el(id) as HTMLInputElement).disabled = busy;
}
function populateItems() { el('item').replaceChildren(); for (const item of kind() === 'trinket' ? TRINKETS : ITEM_DEFINITIONS) { const option = document.createElement('option'); option.value = String(item.id); option.textContent = `${item.name} (#${item.id})`; el('item').append(option); } }
populateItems();
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
  button.onclick = () => {
    if (busy) return;
    el<HTMLSelectElement>('kind').value = button.dataset.kind!;
    el('kind').dispatchEvent(new Event('change'));
  };
});
wallet.subscribe(() => {render(); void refreshAllowance();});
el('kind').addEventListener('change', () => { el<HTMLInputElement>('token-id').value = kind() === 'parcel' ? '742' : '1'; populateItems(); render(); });
el('self').onclick = () => { if (wallet.snapshot.connectedAddress) el<HTMLInputElement>('recipient').value = wallet.snapshot.connectedAddress; };
el('connect').onclick = async () => { try { await wallet.connect(); if (!input('recipient') && wallet.snapshot.connectedAddress) el<HTMLInputElement>('recipient').value = wallet.snapshot.connectedAddress; } catch (e) { el('status').textContent = message(e); } };
el('switch').onclick = async () => { try { if (!provider) throw new Error('Connect an injected wallet.'); await createWalletClient({ transport: custom(provider) }).switchChain({ id: base.id }); await wallet.refresh(); } catch (e) { el('status').textContent = message(e); } };
el('mint').onsubmit = async event => {
  event.preventDefault(); if (busy || !ready) return;
  let submitted = false;
  try {
    const k = kind(), publicMint = k === 'parcel' && publicParcels;
    const quantity = publicMint ? parcelMintQuantity(input('quantity')) : 1n;
    const value = mintInput(k, publicMint ? wallet.snapshot.connectedAddress??'' : input('recipient'), publicMint ? '0' : input((k === 'item' || k === 'trinket') ? 'item' : 'token-id'), input('quantity'));
    const address = addresses[k]; if (!address) throw new Error('This collection is not configured yet.');
    busy = true; render(); el('result').replaceChildren(); el('status').textContent = 'Checking mint permissions and simulating transaction…';
    const signer = await wallet.forChain(base.id);
    if (!publicMint) {
    const owner = await client.readContract({ address, abi, functionName: 'owner' });
    owners.set(k, owner); if (owner.toLowerCase() !== signer.account.address.toLowerCase()) throw new Error('Only the current contract owner can mint.');
    }
    const args = publicMint ? [quantity] as const : (k === 'item' || k === 'trinket') ? [value.recipient, value.id, value.quantity] as const : [value.recipient, value.id] as const;
    const simulation = await client.simulateContract({ address, abi, functionName: 'mint', args, account: signer.account });
    const fresh = await wallet.forChain(base.id); if (fresh.account.address !== signer.account.address) throw new Error('Wallet changed. Review and submit again.');
    el('status').textContent = publicMint ? `Confirm minting ${quantity} automatically assigned parcel(s). Mint price: 0 ETH, plus network gas.` : `Confirm minting ${k} #${value.id} to ${value.recipient} in your wallet.`;
    const hash = await fresh.writeContract({ ...simulation.request, chain: base }); submitted = true;
    const link = document.createElement('a'); link.href = `https://basescan.org/tx/${hash}`; link.textContent = 'View transaction on Basescan'; link.target = '_blank'; link.rel = 'noopener noreferrer'; el('result').append(link);
    el('status').textContent = 'Submitted. Waiting for confirmation…';
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== 'success') throw new Error('Transaction reverted. No asset was minted.');
    el('status').textContent = publicMint ? `Mint confirmed: ${quantity} parcel(s) to your wallet. See the transaction for assigned IDs.` : `Mint confirmed: ${k} #${value.id}${(k === 'item' || k === 'trinket') ? ` × ${value.quantity}` : ''} → ${value.recipient}`;
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
    addresses = { parcel: getAddress(import.meta.env.VITE_WORLD_PARCEL_NFT_ADDRESS), item: getAddress(import.meta.env.VITE_ATLAS_ITEMS_ADDRESS), character: getAddress(import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS) };
    if (import.meta.env.VITE_DOODVERSE_TRINKETS_ADDRESS) addresses.trinket = getAddress(import.meta.env.VITE_DOODVERSE_TRINKETS_ADDRESS);
    if (await client.getChainId() !== base.id) throw new Error('RPC is not Base mainnet.');
    await Promise.all((Object.keys(addresses) as MintKind[]).map(async k => owners.set(k, await client.readContract({ address: addresses[k]!, abi, functionName: 'owner' }))));
    try { publicParcels=await client.readContract({address:addresses.parcel!,abi,functionName:'PUBLIC_MINT'}); } catch { publicParcels=false; }
    ready = true; void refreshAllowance(); el('setup').textContent = 'Base mainnet · deployed contracts verified for mint authority';
  } catch (e) { el('setup').textContent = message(e); } render();
}
void init();
