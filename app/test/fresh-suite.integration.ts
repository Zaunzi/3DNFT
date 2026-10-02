import {OnchainTrinketProvider} from '../src/trinkets/onchain.ts';
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
    const deploy = async (name: string, args: unknown[]) => { const artifact = JSON.parse(await readFile(`artifacts/atlas-v2/${name}.sol/${name}.json`, 'utf8')); const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex, args, account: alice, chain: null }); const receipt = await client.waitForTransactionReceipt({ hash }); assert.equal(receipt.status, 'success'); return receipt.contractAddress!; };
    const write = async (address: Address, abi: Abi, functionName: string, args: unknown[]) => { const hash = await wallet.writeContract({ address, abi, functionName, args, account: active, chain: null }); assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'success'); };
    const land = await deploy('DoodverseParcels', [7422026n, 'https://world.example/nft/', alice]), characters = await deploy('DoodverseCharacters', [alice]), items = await deploy('DoodverseItems', [alice, 'ipfs://items/{id}']), world = await deploy('DoodverseNFTState', [land, alice]), containers = await deploy('ContainerItemState', [world, items]);
    const trinkets = await deploy('DoodverseTrinkets', [alice]);
    await write(trinkets,parseAbi(['function mint(address,uint256,uint256)']),'mint',[alice,4n,1n]);
    const claimAbi=parseAbi(['function mint(uint256)','function minted(address,uint256) view returns(bool)']);
    assert.equal(await client.readContract({address:trinkets,abi:claimAbi,functionName:'minted',args:[alice,4n]}),true);
    await assert.rejects(client.simulateContract({address:trinkets,abi:claimAbi,functionName:'mint',args:[4n],account:alice}));
    await assert.rejects(client.simulateContract({address:trinkets,abi:claimAbi,functionName:'mint',args:[6n],account:alice}));
    assert.equal(await client.readContract({address:items,abi:parseAbi(['function balanceOf(address,uint256) view returns(uint256)']),functionName:'balanceOf',args:[alice,4n]}),0n);
    await write(world, parseAbi(['function bindContainerItems(address)']), 'bindContainerItems', [containers]);
    const keys=await deploy('DoodverseKeys',[land,alice]);
    await write(keys,parseAbi(['function bindWorld(address)']),'bindWorld',[world]);
    await write(world,parseAbi(['function bindLockKeys(address)']),'bindLockKeys',[keys]);
    for (const [address, expected] of [[land,'Doodverse Parcels'],[characters,'Doodverse Characters'],[items,'Doodverse Parcel Items']] as const) {
        assert.equal(await client.readContract({address,abi:parseAbi(['function name() view returns(string)']),functionName:'name'}),expected);
    }
    await write(land, parseAbi(['function mint(uint256)']), 'mint', [1n]);
    await write(characters, parseAbi(['function mint(address,uint256)']), 'mint', [alice, 1n]);
    await write(items, parseAbi(['function mint(address,uint256,uint256)']), 'mint', [alice, 3n, 20n]);
    const state = await deploy('DoodverseParcelState', [land]);
    await deploy('WorldItemState', [land, items]);
    await deploy('PortalState', [land]);
    await injected.connect();
    const base = new OnchainParcelStateProvider(rpc, land, state, 31337, injected);
    base.client.pollingInterval = 100;
    assert.equal((await base.getWorld()).generatorVersion, 2);
    await base.addObject(0n, {objectType:7,x:3200,z:3200,rotation:9000,y:190});
    assert.equal((await base.getObjects(0n))[0].y,190);
    await assert.rejects(base.addObject(0n,{objectType:8,x:3200,z:3200,rotation:1,y:190}));
    const trinketState=await deploy('WorldTrinketState',[land,trinkets]);
    const trinketProvider=new OnchainTrinketProvider(base.client,injected,{land,items:trinkets,worldItems:trinketState});
    await trinketProvider.validateDeployment();await trinketProvider.approveEscrow();
    await trinketProvider.placeItem(0,{itemType:4,quantity:1n,x:3200,z:3200,rotation:9000});
    assert.equal(await trinketProvider.getBalance(alice,4n),0n);assert.equal((await trinketProvider.getItems(0)).length,1);
    const provider = new OnchainNFTProvider(base.client, injected, { land, world, containers, items, characters });
    await provider.validateDeployment();
    await provider.createDoor(0,{x:3200,z:3200,rotation:0,y:240},{kind:'erc1155',contractAddress:items,tokenId:4n,minimum:1n,mode:'CHECK_ONLY'});
    assert.equal((await provider.snapshot(0)).doors[0].y,240);
    await provider.createKeyedDoor(0,{x:3500,z:3500,rotation:0,y:50});
    const keyed=(await provider.snapshot(0)).doors[1];
    await provider.issueKeyCopies(keyed.requirement.tokenId,bob,1n);
    assert.equal(await provider.canOpen(keyed,bob),true);
    await provider.rekeyDoor(0,keyed.id);
    assert.equal(await provider.canOpen(keyed,bob),false);
    const asset = { chainId: 31337, contractAddress: characters, tokenId: 1n };
    await provider.approve(asset);
    await provider.attach(asset, { kind: 'parcel', parcelId: 0, x: 3200, z: 3200, rotation: 0 });
    assert.equal((await provider.ownerOf(asset)).toLowerCase(), world.toLowerCase());
    await provider.createContainer(0, { x: 3500, z: 3500, rotation: 0 }, 4);
    const [chest] = (await provider.snapshot(0)).containers;
    await provider.move(asset, { kind: 'container', parcelId: 0, containerId: chest.id });
    await provider.approveItems();
    await provider.storeItem(chest.id, 3, 12n);
    await assert.rejects(provider.removeContainer(chest.id));
    const before = await provider.snapshot(0);
    await write(land, parseAbi(['function transferFrom(address,address,uint256)']), 'transferFrom', [alice, bob, 0n]);
    assert.deepEqual(await provider.snapshot(0), before);
    await assert.rejects(provider.detach(asset));
    await assert.rejects(trinketProvider.pickupItem(0,1));
    assert.equal(await provider.canOpen(keyed,alice),false);
    assert.equal(await provider.canOpen(keyed,bob),true);
    active = bob;
    await injected.refresh();
    await trinketProvider.pickupItem(0,1);assert.equal(await trinketProvider.getBalance(bob,4n),1n);assert.equal((await trinketProvider.getItems(0)).length,0);
    await assert.rejects(client.simulateContract({address:trinkets,abi:claimAbi,functionName:'mint',args:[4n],account:alice}));
    await write(trinkets,claimAbi,'mint',[4n]); // Bob may claim his own edition despite receiving Alice's.
    assert.equal(await trinketProvider.getBalance(bob,4n),2n);
    await assert.rejects(client.simulateContract({address:trinkets,abi:claimAbi,functionName:'mint',args:[4n],account:bob}));

    await provider.detach(asset);
    await provider.retrieveItem(chest.id, 3, 12n);
    await provider.removeContainer(chest.id);
    assert.equal((await provider.ownerOf(asset)).toLowerCase(), bob.toLowerCase());
    assert.equal((await provider.snapshot(0)).attachments.length, 0);
    assert.equal(await client.readContract({ address: items, abi: parseAbi(['function balanceOf(address,uint256) view returns(uint256)']), functionName: 'balanceOf', args: [alice, 3n] }), 8n);
    assert.equal(await client.readContract({ address: items, abi: parseAbi(['function balanceOf(address,uint256) view returns(uint256)']), functionName: 'balanceOf', args: [bob, 3n] }), 12n);
    console.log('Fresh suite local integration passed: real ERC721/ERC1155 custody, container movement, land inheritance, Bob withdrawal, no duplicate state.');
}
finally {
    injected.dispose();
    await server.close();
}
