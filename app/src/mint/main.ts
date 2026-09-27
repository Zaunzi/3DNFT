import { createPublicClient, createWalletClient, custom, http, parseAbi, getAddress, type Address } from 'viem';
import { base } from 'viem/chains';
import { InjectedWallet, type InjectedProvider } from '../blockchain/wallet.ts';
import { ITEM_DEFINITIONS } from '../items/definitions.ts';
import { mintInput, type MintKind } from './model.ts';
import './style.css';

document.querySelector('#app')!.innerHTML = `<nav><a href="/">◈ ATLAS / WORLD PARCELS</a><span>BASE MAINNET</span></nav>
<header><p class="eyebrow">OWNER WORKSHOP</p><h1>Mint your world.</h1><p>Create parcels, characters and items, then bring them into Atlas.</p></header>
<section class="wallet"><button id="connect">Connect wallet</button><button id="switch" hidden>Switch to Base</button><p id="wallet">Not connected</p><p id="setup" role="status">Checking deployment…</p></section>
<form id="mint"><label>Asset<select id="kind"><option value="parcel">Parcel · ERC-721</option><option value="character">Character · ERC-721</option><option value="item">Atlas item · ERC-1155</option></select></label>
<p id="help"></p><label>Recipient address<input id="recipient" placeholder="0x…" required autocomplete="off"></label><button id="self" type="button">Use my wallet</button>
<label id="id-label">Token ID<input id="token-id" value="742" inputmode="numeric" required></label>
<label id="item-label" hidden>Item<select id="item"></select></label><label id="quantity-label" hidden>Quantity<input id="quantity" value="1" inputmode="numeric"></label>
<p id="authority"></p><p id="contract"></p><button id="submit" type="submit" disabled>Mint parcel</button><p class="muted">Owner-only minting. Each mint is a separate Base transaction confirmed in your wallet.</p></form>
<section><h2>Transaction</h2><p id="status" role="status">Choose an asset to begin.</p><div id="result"></div></section>
<section><h2>Try it in the world</h2><ol><li>Mint parcel 742 to your wallet, then <a href="/?tokenId=742">open parcel #742</a> and connect that wallet.</li><li>Mint a character (start with #1) and some items to the same wallet.</li><li>Use Inventory to place items, or NFTs / Containers to approve and attach a character. For other character IDs, enter the character contract and token ID in that panel.</li></ol><p class="muted">Buildings and portals are parcel state, not separate mintable NFTs. Pets, art and vehicles were mock fixtures; you can attach your own external ERC-721s through the world UI.</p></section>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id).value.trim();
const provider = (window as Window & { ethereum?: InjectedProvider }).ethereum;
const wallet = new InjectedWallet(provider);
const abi = parseAbi(['function owner() view returns(address)', 'function mint(address,uint256)', 'function mint(address,uint256,uint256)']);
let busy = false, ready = false;
let addresses: Record<MintKind, Address>;
const owners = new Map<MintKind, Address>();
const client = createPublicClient({ chain: base, transport: http(import.meta.env.VITE_RPC_URL || 'https://base-rpc.publicnode.com'), batch: { multicall: { wait: 40 } } });
const kind = () => input('kind') as MintKind;
const message = (error: unknown) => error instanceof Error ? ('shortMessage' in error ? String(error.shortMessage) : error.message) : 'Request failed. Please retry.';
function render() {
  const k = kind(), account = wallet.snapshot.connectedAddress;
  el('wallet').textContent = account ? `${account} · chain ${wallet.snapshot.chainId}` : 'Not connected';
  el('switch').hidden = !account || wallet.snapshot.chainId === base.id;
  el('id-label').hidden = k === 'item'; el('item-label').hidden = k !== 'item'; el('quantity-label').hidden = k !== 'item';
  el('help').textContent = k === 'parcel' ? 'One place in the shared world. Choose an unused ID from 0–4999.' : k === 'character' ? 'A native character NFT you can attach to a parcel or store in a container.' : 'Stone, wood, crystal, keys, lanterns and portal cores. Items can be placed through your world inventory.';
  el('authority').textContent = owners.has(k) ? `Mint authority: ${owners.get(k)}${account && account.toLowerCase() !== owners.get(k)!.toLowerCase() ? ' — connected wallet is not the owner.' : ''}` : '';
  el('contract').textContent = addresses ? `Contract: ${addresses[k]}` : '';
  const submit = el<HTMLButtonElement>('submit'); submit.textContent = busy ? 'Transaction in progress…' : `Mint ${k}`;
  submit.disabled = busy || !ready || wallet.snapshot.chainId !== base.id || !account || account.toLowerCase() !== owners.get(k)?.toLowerCase();
  for (const id of ['kind','recipient','token-id','item','quantity','self','connect','switch']) (el(id) as HTMLInputElement).disabled = busy;
}
for (const item of ITEM_DEFINITIONS) { const option = document.createElement('option'); option.value = String(item.id); option.textContent = `${item.name} (#${item.id})`; el('item').append(option); }
wallet.subscribe(render);
el('kind').addEventListener('change', () => { el<HTMLInputElement>('token-id').value = kind() === 'parcel' ? '742' : '1'; render(); });
el('self').onclick = () => { if (wallet.snapshot.connectedAddress) el<HTMLInputElement>('recipient').value = wallet.snapshot.connectedAddress; };
el('connect').onclick = async () => { try { await wallet.connect(); if (!input('recipient') && wallet.snapshot.connectedAddress) el<HTMLInputElement>('recipient').value = wallet.snapshot.connectedAddress; } catch (e) { el('status').textContent = message(e); } };
el('switch').onclick = async () => { try { if (!provider) throw new Error('Connect an injected wallet.'); await createWalletClient({ transport: custom(provider) }).switchChain({ id: base.id }); await wallet.refresh(); } catch (e) { el('status').textContent = message(e); } };
el('mint').onsubmit = async event => {
  event.preventDefault(); if (busy || !ready) return;
  let submitted = false;
  try {
    const k = kind(), value = mintInput(k, input('recipient'), input(k === 'item' ? 'item' : 'token-id'), input('quantity'));
    busy = true; render(); el('result').replaceChildren(); el('status').textContent = 'Checking mint permissions and simulating transaction…';
    const signer = await wallet.forChain(base.id);
    const owner = await client.readContract({ address: addresses[k], abi, functionName: 'owner' });
    owners.set(k, owner); if (owner.toLowerCase() !== signer.account.address.toLowerCase()) throw new Error('Only the current contract owner can mint.');
    const args = k === 'item' ? [value.recipient, value.id, value.quantity] as const : [value.recipient, value.id] as const;
    const simulation = await client.simulateContract({ address: addresses[k], abi, functionName: 'mint', args, account: signer.account });
    const fresh = await wallet.forChain(base.id); if (fresh.account.address !== signer.account.address) throw new Error('Wallet changed. Review and submit again.');
    el('status').textContent = `Confirm minting ${k} #${value.id} to ${value.recipient} in your wallet.`;
    const hash = await fresh.writeContract({ ...simulation.request, chain: base }); submitted = true;
    const link = document.createElement('a'); link.href = `https://basescan.org/tx/${hash}`; link.textContent = 'View transaction on Basescan'; link.target = '_blank'; link.rel = 'noopener noreferrer'; el('result').append(link);
    el('status').textContent = 'Submitted. Waiting for confirmation…';
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== 'success') throw new Error('Transaction reverted. No asset was minted.');
    el('status').textContent = `Mint confirmed: ${k} #${value.id}${k === 'item' ? ` × ${value.quantity}` : ''} → ${value.recipient}`;
    if (k === 'parcel') { const open = document.createElement('a'); open.href = `/?tokenId=${value.id}`; open.textContent = 'Open this parcel'; el('result').append(document.createElement('br'), open); }
  } catch (e) { el('status').textContent = `${message(e)}${submitted ? ' Check the linked transaction before trying another mint.' : ''}`; }
  finally { busy = false; render(); }
};
async function init() {
  try {
    if (import.meta.env.VITE_WORLD_STATE_MODE !== 'onchain' || Number(import.meta.env.VITE_CHAIN_ID) !== base.id) throw new Error('Minting requires the Base production configuration. Local mock mode does not mint real assets.');
    addresses = { parcel: getAddress(import.meta.env.VITE_WORLD_PARCEL_NFT_ADDRESS), item: getAddress(import.meta.env.VITE_ATLAS_ITEMS_ADDRESS), character: getAddress(import.meta.env.VITE_ATLAS_CHARACTERS_ADDRESS) };
    if (await client.getChainId() !== base.id) throw new Error('RPC is not Base mainnet.');
    await Promise.all((Object.keys(addresses) as MintKind[]).map(async k => owners.set(k, await client.readContract({ address: addresses[k], abi, functionName: 'owner' }))));
    ready = true; el('setup').textContent = 'Base mainnet · deployed contracts verified for mint authority';
  } catch (e) { el('setup').textContent = message(e); } render();
}
void init();
