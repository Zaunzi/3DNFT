import { BaseError, ContractFunctionRevertedError, createPublicClient, decodeErrorResult, defineChain, fallback, http, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { landAbi, stateAbi, stateV2Abi } from './contracts.ts';
import type { WorldStateProvider } from './state.ts';
import type { InjectedWallet } from './wallet.ts';
import type { ParcelStateStore } from './parcelState.ts';
import { MAX_OBJECTS, validatePlacement, type ObjectPlacement, type PersistentWorldObject } from '../objects/model.ts';
import { WORLD_WIDTH, WORLD_DEPTH, PARCEL_SIZE } from '../world/constants.ts';
import { tokenIdToCoordinate } from '../world/coordinates.ts';

export class OnchainParcelStateProvider implements WorldStateProvider, ParcelStateStore {
  readonly mode = 'ONCHAIN STATE';
  schemaVersion = 1;
  readonly client;
  private land: Address;
  private state: Address | undefined;
  private chainId: number;
  private wallet: InjectedWallet;
  constructor(rpc: string, land: Address, state: Address | undefined, chainId: number, wallet: InjectedWallet) {
    const chain = defineChain({ id: chainId, name: chainId === base.id ? 'Base' : `World chain ${chainId}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } }, contracts: chainId === base.id ? base.contracts : undefined });
    // A streamed neighborhood reads several contracts per parcel. Aggregate Base
    // reads through its known Multicall3 deployment instead of bursting RPC calls.
    // Other chains keep the existing behavior and do not assume Multicall exists.
    this.client = createPublicClient({ chain, transport: chainId === base.id && rpc === 'https://base-rpc.publicnode.com' ? fallback([http(rpc),http('https://mainnet.base.org')]) : http(rpc), batch: { multicall: chainId === base.id ? { wait: 40, batchSize: 16384 } : false }, pollingInterval: 4000 });
    this.land = land; this.state = state; this.chainId = chainId; this.wallet = wallet;
  }
  async getWorld() {
    if (await this.client.getChainId() !== this.chainId) throw new Error('RPC chain does not match configured chain');
    const read = <T extends 'collectionSeed' | 'GENERATOR_VERSION' | 'WORLD_WIDTH' | 'WORLD_DEPTH' | 'PARCEL_SIZE'>(functionName: T) => this.client.readContract({ address: this.land, abi: landAbi, functionName });
    const [seed, version, width, depth, size] = await Promise.all([read('collectionSeed'), read('GENERATOR_VERSION'), read('WORLD_WIDTH'), read('WORLD_DEPTH'), read('PARCEL_SIZE')]);
    if (Number(width) !== WORLD_WIDTH || Number(depth) !== WORLD_DEPTH || Number(size) !== PARCEL_SIZE) throw new Error('Unsupported world topology');
    if (this.state) {
      const [land, schema] = await Promise.all([
        this.client.readContract({ address: this.state, abi: stateAbi, functionName: 'land' }),
        this.client.readContract({ address: this.state, abi: stateAbi, functionName: 'SCHEMA_VERSION' }),
      ]);
      if (land.toLowerCase() !== this.land.toLowerCase() || ![1,2].includes(schema)) throw new Error('ParcelState collection or schema mismatch');
      this.schemaVersion=schema;
    }
    return { seed: BigInt(seed), generatorVersion: Number(version) };
  }
  async getParcel(tokenId: number) {
    tokenIdToCoordinate(tokenId);
    try { return { owner: await this.client.readContract({ address: this.land, abi: landAbi, functionName: 'ownerOf', args: [BigInt(tokenId)] }), version: 0 }; }
    catch (error) {
      const revert = error instanceof BaseError ? error.walk(e => e instanceof ContractFunctionRevertedError) : error;
      if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName === 'ERC721NonexistentToken') return { owner: null, version: 0 };
      // Some RPCs (including Ganache) return revert bytes under a generic -32000 error.
      // Decode only the explicit missing-token error; never turn a network failure into unminted land.
      let cause: unknown = error;
      for (let depth = 0; depth < 12 && cause && typeof cause === 'object'; depth++) {
        const node = cause as { data?: unknown; cause?: unknown };
        if (typeof node.data === 'string' && node.data.startsWith('0x')) {
          try { const decoded = decodeErrorResult({ abi: landAbi, data: node.data as Hex }); if (decoded.errorName === 'ERC721NonexistentToken' && decoded.args[0] === BigInt(tokenId)) return { owner: null, version: 0 }; } catch { /* Preserve unknown failures. */ }
        }
        cause = node.cause;
      }
      throw error;
    }
  }
  async getObjects(tokenId: bigint): Promise<PersistentWorldObject[]> {
    tokenIdToCoordinate(Number(tokenId));
    if (!this.state) return []; // Preserve the original read-only NFT runtime configuration.
    const objects = this.schemaVersion===2?await this.client.readContract({address:this.state,abi:stateV2Abi,functionName:'getObjects',args:[tokenId]}):await this.client.readContract({ address: this.state, abi: stateAbi, functionName: 'getObjects', args: [tokenId] });
    if (objects.length > MAX_OBJECTS) throw new Error('Unsupported object count');
    const result = objects.map(object => ({
      id: object.id, x: object.x, z: object.z, rotation: object.rotation,
      objectType: object.objectType as ObjectPlacement['objectType'],
      ...(object.objectType >= 7 && 'y' in object ? { y: Number(object.y) } : {}),
    }));
    result.forEach(validatePlacement); return result;
  }
  private async write(tokenId: bigint, placementOrId: ObjectPlacement | number) {
    if (!this.state) throw new Error('Configure VITE_PARCEL_STATE_ADDRESS to enable building.');
    const wallet = await this.wallet.forChain(this.chainId);
    const common = { address: this.state, abi: stateAbi, account: wallet.account } as const;
    if(this.schemaVersion===2){
      const simulation=typeof placementOrId==='number'
        ?await this.client.simulateContract({address:this.state,abi:stateV2Abi,account:wallet.account,functionName:'removeObject',args:[tokenId,placementOrId]})
        :await this.client.simulateContract({address:this.state,abi:stateV2Abi,account:wallet.account,functionName:'placeObject',args:[tokenId,placementOrId.objectType,placementOrId.x,placementOrId.z,placementOrId.rotation,placementOrId.y??0]});
      const fresh=await this.wallet.forChain(this.chainId);if(fresh.account.address!==wallet.account.address)throw new Error('Wallet changed');
      const hash=simulation.request.functionName==='placeObject'
        ?await fresh.writeContract({...simulation.request,chain:this.client.chain})
        :await fresh.writeContract({...simulation.request,chain:this.client.chain});
      if((await this.client.waitForTransactionReceipt({hash})).status!=='success')throw new Error('Transaction reverted');return;
    }
    const simulation = typeof placementOrId === 'number'
      ? await this.client.simulateContract({ ...common, functionName: 'removeObject', args: [tokenId, placementOrId] })
      : await this.client.simulateContract({ ...common, functionName: 'placeObject', args: [tokenId, placementOrId.objectType, placementOrId.x, placementOrId.z, placementOrId.rotation] });
    // Recheck after simulation; a wallet may have changed account or chain meanwhile.
    const fresh = await this.wallet.forChain(this.chainId);
    if (fresh.account.address !== wallet.account.address) throw new Error('Wallet changed. Review placement again.');
    const hash = simulation.request.functionName === 'placeObject'
      ? await fresh.writeContract({ ...simulation.request, chain: this.client.chain })
      : await fresh.writeContract({ ...simulation.request, chain: this.client.chain });
    const receipt = await this.client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
  }
  async addObject(tokenId: bigint, placement: ObjectPlacement) { validatePlacement(placement); if(placement.objectType>=7&&this.schemaVersion!==2)throw new Error('Modular building requires ParcelState schema 2.'); await this.write(tokenId, placement); }
  async removeObject(tokenId: bigint, objectId: number) { await this.write(tokenId, objectId); }
  subscribe(onChange: (tokenId: bigint) => void, onError?: (error: unknown) => void) {
    let active = true;
    let cursor: bigint | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const latest = await this.client.getBlockNumber({ cacheTime: 0 });
        if (!active) return;
        // Small overlap tolerates short reorgs; periodic snapshot reads reconcile deeper changes.
        // Limit each query after a long outage rather than requesting an unbounded log history.
        const previous = cursor === undefined ? latest : cursor > 1n ? cursor - 1n : 0n;
        const fromBlock = latest > previous + 2000n ? latest - 2000n : previous > latest ? latest : previous;
        if (cursor !== latest) {
          const [transfers, modifications] = await Promise.all([
            this.client.getContractEvents({ address: this.land, abi: landAbi, eventName: 'Transfer', fromBlock, toBlock: latest }),
            this.state ? this.client.getContractEvents({ address: this.state, abi: this.schemaVersion===2?stateV2Abi:stateAbi, fromBlock, toBlock: latest }) : Promise.resolve([]),
          ]);
          if (!active) return;
          const changed = new Set<bigint>();
          for (const log of [...transfers, ...modifications]) if (log.args.tokenId !== undefined) changed.add(log.args.tokenId);
          cursor = latest;
          for (const id of changed) onChange(id);
        }
      } catch (error) { if (active) onError?.(error); }
      finally { if (active) timer = setTimeout(() => { void poll(); }, this.client.pollingInterval); }
    };
    void poll();
    // No server filter to uninstall: cancellation works even after RPC loss.
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); };
  }
}
