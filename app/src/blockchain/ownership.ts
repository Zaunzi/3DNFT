import type { WalletSnapshot } from './wallet.ts';

export function isParcelOwner(owner: string | null, wallet: WalletSnapshot, expectedChainId: number): boolean {
  return wallet.isConnected && wallet.chainId === expectedChainId && owner !== null &&
    wallet.connectedAddress !== null && owner.toLowerCase() === wallet.connectedAddress.toLowerCase();
}
