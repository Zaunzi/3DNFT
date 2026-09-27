import { getAddress, isAddress, type Address } from 'viem';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
export const DEFAULT_MOCK_ADDRESS = '0x1111111111111111111111111111111111111111';
export interface WorldConfig {
  mode: 'mock' | 'onchain'; chainId: number; rpc?: string; land?: Address; state?: Address;
  mockAddress: Address; mockParcels: Set<number>;
}
export function readConfig(env: Record<string, string | undefined>): WorldConfig {
  const rpc = env.VITE_RPC_URL || env.VITE_WORLD_RPC_URL;
  const land = env.VITE_WORLD_PARCEL_NFT_ADDRESS || env.VITE_WORLD_ADDRESS;
  const chain = env.VITE_CHAIN_ID || env.VITE_WORLD_CHAIN_ID;
  const state = env.VITE_PARCEL_STATE_ADDRESS;
  const mode = env.VITE_WORLD_STATE_MODE ?? (rpc || land || chain || state ? 'onchain' : 'mock');
  if (mode !== 'mock' && mode !== 'onchain') throw new Error('VITE_WORLD_STATE_MODE must be mock or onchain');
  const chainId = Number(chain ?? 31337);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('Invalid chain ID');
  if (mode === 'onchain' && (!rpc || !land || !chain)) throw new Error('Onchain mode requires RPC URL, NFT address and chain ID.');
  for (const address of [land, state]) if (address && !isAddress(address)) throw new Error('Invalid contract address');
  const mockAddress = getAddress(env.VITE_MOCK_OWNER_ADDRESS || DEFAULT_MOCK_ADDRESS);
  const mockParcels = new Set((env.VITE_MOCK_OWNED_PARCELS ?? '742,743,744').split(',').filter(Boolean).map(value => {
    if (!/^\d+$/.test(value.trim())) throw new Error('Invalid mock parcel ID');
    const id = Number(value); tokenIdToCoordinate(id); return id;
  }));
  return { mode, chainId, rpc, land: land ? getAddress(land) : undefined, state: state ? getAddress(state) : undefined, mockAddress, mockParcels };
}
