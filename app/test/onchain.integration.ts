// Run after forge build --root contracts. Uses an ephemeral local chain; never a public RPC.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { InjectedWallet, type InjectedProvider } from '../src/blockchain/wallet.ts';
import { OnchainParcelStateProvider } from '../src/blockchain/client.ts';

const server = ganache.server({ chain: { chainId: 31337, hardfork: 'shanghai' }, miner: { defaultTransactionGasLimit: 10000000 }, wallet: { deterministic: true }, logging: { quiet: true } });
await server.listen(0, '127.0.0.1');
const port = (server.address() as { port: number }).port;
const rpc = `http://127.0.0.1:${port}`;
const publicClient = createPublicClient({ transport: http(rpc), pollingInterval: 100 });
const wallet = createWalletClient({ transport: http(rpc) });
const accounts = await wallet.getAddresses();
const owner = accounts[0], other = accounts[1];
let active = owner;
const provider: InjectedProvider = {
  request: (async (request: { method: string; params?: unknown[] }) => {
    if (request.method === 'eth_requestAccounts' || request.method === 'eth_accounts') return [active];
    return server.provider.request(request as Parameters<typeof server.provider.request>[0]);
  }) as InjectedProvider['request'],
};
const injected = new InjectedWallet(provider);
let stopEvents: (() => void) | undefined;
try {
  const landArtifact = JSON.parse(await readFile('contracts/out/WorldParcelNFT.sol/WorldParcelNFT.json','utf8'));
  const stateArtifact = JSON.parse(await readFile('contracts/out/ParcelState.sol/ParcelState.json','utf8'));
  const deploy = async (artifact: typeof landArtifact, args: unknown[]): Promise<Address> => {
    const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex, args, account: owner, chain: null });
    const receipt = await publicClient.waitForTransactionReceipt({hash}); assert.equal(receipt.status,'success'); return receipt.contractAddress!;
  };
  const land = await deploy(landArtifact,[7422026n,'https://world.example/nft/',owner]);
  const state = await deploy(stateArtifact,[land]);
  const mint = await wallet.writeContract({address:land,abi:parseAbi(['function mint(address,uint256)']),functionName:'mint',args:[owner,742n],account:owner,chain:null});
  await publicClient.waitForTransactionReceipt({hash:mint});
  await injected.connect();
  const backend = new OnchainParcelStateProvider(rpc,land,state,31337,injected);
  backend.client.pollingInterval = 100;
  assert.equal((await backend.getWorld()).seed,7422026n);
  assert.equal((await backend.getParcel(742)).owner?.toLowerCase(),owner.toLowerCase());
  assert.equal((await backend.getParcel(743)).owner,null);
  const events: bigint[] = []; const eventErrors: unknown[] = [];
  stopEvents = backend.subscribe(id=>events.push(id),error=>eventErrors.push(error));
  // Allow the filter's starting block to be established before sending a transaction.
  await new Promise(resolve=>setTimeout(resolve,300));
  await backend.addObject(742n,{objectType:1,x:1200,z:2700,rotation:9000});
  assert.deepEqual(await backend.getObjects(742n),[{id:1,objectType:1,x:1200,z:2700,rotation:9000}]);
  const reloaded = new OnchainParcelStateProvider(rpc,land,state,31337,injected);
  assert.equal((await reloaded.getObjects(742n)).length,1);
  active=other; await injected.refresh();
  await assert.rejects(backend.addObject(742n,{objectType:1,x:1000,z:1000,rotation:0}));
  await assert.rejects(backend.removeObject(742n,1));
  active=owner; await injected.refresh();
  const transfer = await wallet.writeContract({address:land,abi:parseAbi(['function transferFrom(address,address,uint256)']),functionName:'transferFrom',args:[owner,other,742n],account:owner,chain:null});
  await publicClient.waitForTransactionReceipt({hash:transfer});
  await assert.rejects(backend.removeObject(742n,1));
  active=other; await injected.refresh(); await backend.removeObject(742n,1); assert.deepEqual(await backend.getObjects(742n),[]);
  const deadline = Date.now()+5000;
  while (!events.includes(742n) && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok(events.includes(742n),'Expected event invalidation'); assert.deepEqual(eventErrors,[]);
  const mismatch=new OnchainParcelStateProvider(rpc,land,state,1,injected); await assert.rejects(mismatch.getWorld(),/chain/);
  console.log('Onchain integration passed: deploy, ownership, placement, reload, authorization, transfer, removal, events and chain mismatch.');
} finally {
  stopEvents?.(); injected.dispose();
  await server.close();
  console.log('Local chain closed.');
}
