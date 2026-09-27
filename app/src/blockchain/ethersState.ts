import { Contract, JsonRpcProvider, isError } from 'ethers';
import type { WorldStateProvider } from './state.ts';
import { WORLD_WIDTH, WORLD_DEPTH, PARCEL_SIZE } from '../world/constants.ts';
const abi = ['function collectionSeed() view returns(uint256)', 'function GENERATOR_VERSION() view returns(uint32)', 'function WORLD_WIDTH() view returns(uint256)', 'function WORLD_DEPTH() view returns(uint256)', 'function PARCEL_SIZE() view returns(uint256)', 'function ownerOf(uint256) view returns(address)', 'function parcelState(uint256) view returns(uint32)', 'error ERC721NonexistentToken(uint256)'];
export class EthersWorldState implements WorldStateProvider {
  readonly mode = 'ONCHAIN STATE';
  private contract: Contract;
  constructor(rpc: string, address: string, private expectedChain: bigint) { this.contract = new Contract(address, abi, new JsonRpcProvider(rpc)); }
  async getWorld() {
    const provider = this.contract.runner!.provider!;
    if ((await provider.getNetwork()).chainId !== this.expectedChain) throw new Error('RPC chain does not match VITE_WORLD_CHAIN_ID');
    const [seed, version, width, depth, size] = await Promise.all([this.contract.collectionSeed(), this.contract.GENERATOR_VERSION(), this.contract.WORLD_WIDTH(), this.contract.WORLD_DEPTH(), this.contract.PARCEL_SIZE()]);
    if (Number(width) !== WORLD_WIDTH || Number(depth) !== WORLD_DEPTH || Number(size) !== PARCEL_SIZE) throw new Error('Unsupported world topology');
    return { seed: BigInt(seed), generatorVersion: Number(version) };
  }
  async getParcel(tokenId: number) {
    try { const [owner, version] = await Promise.all([this.contract.ownerOf(tokenId), this.contract.parcelState(tokenId)]); return { owner: String(owner), version: Number(version) }; }
    catch (error) { if (isError(error, 'CALL_EXCEPTION') && error.data && this.contract.interface.parseError(error.data)?.name === 'ERC721NonexistentToken') return { owner: null, version: 0 }; throw error; }
  }
}
