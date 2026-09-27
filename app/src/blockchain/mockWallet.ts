import type { Address } from 'viem';
import type { WalletSession, WalletSnapshot } from './wallet.ts';
export class MockWallet implements WalletSession {
  snapshot: WalletSnapshot = { connectedAddress: null, chainId: null, isConnected: false };
  private address: Address;
  private chainId: number;
  private listeners = new Set<(state: WalletSnapshot) => void>();
  constructor(address: Address, chainId: number) { this.address = address; this.chainId = chainId; }
  async connect() { this.snapshot = { connectedAddress: this.address, chainId: this.chainId, isConnected: true }; this.emit(); return this.snapshot; }
  async useAddress(address:Address) { this.address=address; return this.connect(); }
  disconnect() { this.snapshot = { connectedAddress: null, chainId: null, isConnected: false }; this.emit(); }
  subscribe(listener: (snapshot: WalletSnapshot) => void) { this.listeners.add(listener); listener(this.snapshot); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(this.snapshot); }
  dispose() { this.listeners.clear(); }
}
