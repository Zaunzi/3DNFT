import type {WalletSnapshot} from '../blockchain/wallet.ts';
/** Transaction checks republish the same wallet; that is not an identity change. */
export function walletIdentityChanged(before:WalletSnapshot,after:WalletSnapshot){
 return before.isConnected!==after.isConnected||before.chainId!==after.chainId||before.connectedAddress?.toLowerCase()!==after.connectedAddress?.toLowerCase();
}
