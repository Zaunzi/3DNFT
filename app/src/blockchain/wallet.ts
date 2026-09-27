import { createWalletClient, custom, getAddress, isAddress, type Address, type EIP1193Provider } from 'viem';

export interface WalletSnapshot {
  connectedAddress: Address | null;
  chainId: number | null;
  isConnected: boolean;
}
export interface WalletSession {
  readonly snapshot: WalletSnapshot;
  connect(): Promise<WalletSnapshot>;
  disconnect(): void;
  subscribe(listener: (snapshot: WalletSnapshot) => void): () => void;
  dispose(): void;
}

export interface InjectedProvider {
  request: EIP1193Provider['request'];
  on?(event: string, listener: () => void): void;
  removeListener?(event: string, listener: () => void): void;
}

const disconnected = (): WalletSnapshot => ({ connectedAddress: null, chainId: null, isConnected: false });

/** Connection is independent of the read-only world client. No wallet is needed to explore. */
export class InjectedWallet {
  snapshot: WalletSnapshot = disconnected();
  private provider: InjectedProvider | undefined;
  private listeners = new Set<(snapshot: WalletSnapshot) => void>();
  private generation = 0;
  private enabled = false;
  private disposed = false;

  constructor(provider?: InjectedProvider) {
    this.provider = provider;
    provider?.on?.('accountsChanged', this.changed);
    provider?.on?.('chainChanged', this.changed);
    provider?.on?.('disconnect', this.lostConnection);
  }

  get available() { return this.provider !== undefined; }

  subscribe(listener: (snapshot: WalletSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => { this.listeners.delete(listener); };
  }

  private publish(snapshot: WalletSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private lostConnection = () => {
    ++this.generation;
    this.publish(disconnected());
  };

  private changed = () => {
    if (!this.enabled || this.disposed) return;
    // Invalidate permissions synchronously before asynchronous account/network reads.
    this.lostConnection();
    void this.refresh().catch(() => this.lostConnection());
  };

  async connect(): Promise<WalletSnapshot> {
    if (!this.provider) throw new Error('Install an injected wallet such as MetaMask or Rabby.');
    if (this.disposed) throw new Error('Wallet client disposed');
    const generation = ++this.generation;
    await createWalletClient({ transport: custom(this.provider) }).requestAddresses();
    if (generation !== this.generation || this.disposed) return this.snapshot;
    this.enabled = true;
    return this.refresh();
  }

  async refresh(): Promise<WalletSnapshot> {
    if (!this.provider || !this.enabled || this.disposed) return this.snapshot;
    const generation = ++this.generation;
    const client = createWalletClient({ transport: custom(this.provider) });
    const [accounts, chainId] = await Promise.all([client.getAddresses(), client.getChainId()]);
    if (generation !== this.generation || this.disposed) return this.snapshot;
    const account = accounts[0];
    this.publish(account && isAddress(account)
      ? { connectedAddress: getAddress(account), chainId, isConnected: true }
      : disconnected());
    return this.snapshot;
  }

  /** Returns a client only after a fresh account/network read; contract authorization remains decisive. */
  async forChain(expectedChainId: number) {
    const current = await this.refresh();
    if (!this.provider || !current.connectedAddress) throw new Error('Connect a wallet first.');
    if (current.chainId !== expectedChainId) throw new Error(`Switch your wallet to chain ${expectedChainId}.`);
    return createWalletClient({ account: current.connectedAddress, transport: custom(this.provider) });
  }

  disconnect() {
    this.enabled = false;
    this.lostConnection();
    // Local disconnection does not revoke permissions in the wallet extension.
  }

  dispose() {
    this.disposed = true;
    this.disconnect();
    this.provider?.removeListener?.('accountsChanged', this.changed);
    this.provider?.removeListener?.('chainChanged', this.changed);
    this.provider?.removeListener?.('disconnect', this.lostConnection);
    this.listeners.clear();
  }
}
