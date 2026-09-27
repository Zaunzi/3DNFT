// Ephemeral local-chain integration. No public network or real funds.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex, type Abi } from 'viem';
import { InjectedWallet, type InjectedProvider } from '../src/blockchain/wallet.ts';
import { OnchainParcelStateProvider } from '../src/blockchain/client.ts';
import { OnchainNFTProvider } from '../src/nfts/onchain.ts';
const server = ganache.server({ chain: { chainId: 31337, hardfork: 'shanghai' }, miner: { defaultTransactionGasLimit: 15000000 }, wallet: { deterministic: true }, logging: { quiet: true } });
await server.listen(0, '127.0.0.1');
const rpc = `http://127.0.0.1:${(server.address() as {
    port: number;
}).port}`, client = createPublicClient({ transport: http(rpc), pollingInterval: 100 }), wallet = createWalletClient({ transport: http(rpc) });
const [alice, bob] = await wallet.getAddresses();
let active = alice;
const injected = new InjectedWallet({ request: (async (r: {
        method: string;
        params?: unknown[];
    }) => r.method === 'eth_accounts' || r.method === 'eth_requestAccounts' ? [active] : server.provider.request(r as Parameters<typeof server.provider.request>[0])) as InjectedProvider['request'] });
try {
    const deploy = async (name: string, args: unknown[]) => { const artifact = JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`, 'utf8')); const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex, args, account: alice, chain: null }); const receipt = await client.waitForTransactionReceipt({ hash }); assert.equal(receipt.status, 'success'); return receipt.contractAddress!; };
    const write = async (address: Address, abi: Abi, functionName: string, args: unknown[]) => { const hash = await wallet.writeContract({ address, abi, functionName, args, account: active, chain: null }); assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'success'); };
    const land = await deploy('WorldParcelNFT', [7422026n, 'https://world.example/nft/', alice]), characters = await deploy('AtlasCharacters', [alice]), items = await deploy('AtlasItems', [alice, 'ipfs://items/{id}']), world = await deploy('WorldNFTState', [land, alice]), containers = await deploy('ContainerItemState', [world, items]);
    await write(world, parseAbi(['function bindContainerItems(address)']), 'bindContainerItems', [containers]);
    await write(land, parseAbi(['function mint(address,uint256)']), 'mint', [alice, 742n]);
    await write(characters, parseAbi(['function mint(address,uint256)']), 'mint', [alice, 1n]);
    await write(items, parseAbi(['function mint(address,uint256,uint256)']), 'mint', [alice, 3n, 20n]);
    await injected.connect();
    const base = new OnchainParcelStateProvider(rpc, land, undefined, 31337, injected);
    base.client.pollingInterval = 100;
    const provider = new OnchainNFTProvider(base.client, injected, { land, world, containers, items, characters });
    await provider.validateDeployment();
    const asset = { chainId: 31337, contractAddress: characters, tokenId: 1n };
    await provider.approve(asset);
    await provider.attach(asset, { kind: 'parcel', parcelId: 742, x: 3200, z: 3200, rotation: 0 });
    assert.equal((await provider.ownerOf(asset)).toLowerCase(), world.toLowerCase());
    await provider.createContainer(742, { x: 3500, z: 3500, rotation: 0 }, 4);
    const [chest] = (await provider.snapshot(742)).containers;
    await provider.move(asset, { kind: 'container', parcelId: 742, containerId: chest.id });
    await provider.approveItems();
    await provider.storeItem(chest.id, 3, 12n);
    await assert.rejects(provider.removeContainer(chest.id));
    const before = await provider.snapshot(742);
    await write(land, parseAbi(['function transferFrom(address,address,uint256)']), 'transferFrom', [alice, bob, 742n]);
    assert.deepEqual(await provider.snapshot(742), before);
    await assert.rejects(provider.detach(asset));
    active = bob;
    await injected.refresh();
    await provider.detach(asset);
    await provider.retrieveItem(chest.id, 3, 12n);
    await provider.removeContainer(chest.id);
    assert.equal((await provider.ownerOf(asset)).toLowerCase(), bob.toLowerCase());
    assert.equal((await provider.snapshot(742)).attachments.length, 0);
    assert.equal(await client.readContract({ address: items, abi: parseAbi(['function balanceOf(address,uint256) view returns(uint256)']), functionName: 'balanceOf', args: [alice, 3n] }), 8n);
    assert.equal(await client.readContract({ address: items, abi: parseAbi(['function balanceOf(address,uint256) view returns(uint256)']), functionName: 'balanceOf', args: [bob, 3n] }), 12n);
    console.log('NFT local integration passed: real ERC721/ERC1155 custody, container movement, land inheritance, Bob withdrawal, no duplicate state.');
}
finally {
    injected.dispose();
    await server.close();
}
