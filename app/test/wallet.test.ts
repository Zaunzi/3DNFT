import test from 'node:test';
import assert from 'node:assert/strict';
import { InjectedWallet, type InjectedProvider } from '../src/blockchain/wallet.ts';
import { isParcelOwner } from '../src/blockchain/ownership.ts';

const owner = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';

function injected() {
  const handlers = new Map<string, Set<() => void>>();
  let accounts = [owner];
  let chain = '0x7a69';
  let rejected = false;
  const provider: InjectedProvider = {
    request: (async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts' && rejected) throw Object.assign(new Error('User rejected'), { code: 4001 });
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return accounts;
      if (method === 'eth_chainId') return chain;
      throw new Error(`Unexpected request ${method}`);
    }) as InjectedProvider['request'],
    on(event, listener) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event)!.add(listener); },
    removeListener(event, listener) { handlers.get(event)?.delete(listener); },
  };
  return { provider, handlers,
    accounts(value: string[]) { accounts = value; for (const cb of handlers.get('accountsChanged') ?? []) cb(); },
    chain(value: string) { chain = value; for (const cb of handlers.get('chainChanged') ?? []) cb(); },
    reject() { rejected = true; },
  };
}

test('anonymous exploration and unavailable/rejected wallets remain disconnected', async () => {
  const absent = new InjectedWallet(); assert.equal(absent.snapshot.isConnected, false);
  await assert.rejects(absent.connect(), /Install an injected wallet/);
  const fake = injected(); fake.reject(); const wallet = new InjectedWallet(fake.provider);
  await assert.rejects(wallet.connect()); assert.equal(wallet.snapshot.isConnected, false); wallet.dispose();
});

test('wallet connection, account/chain changes, ownership and local disconnect', async () => {
  const fake = injected(), wallet = new InjectedWallet(fake.provider);
  await wallet.connect(); assert.equal(wallet.snapshot.connectedAddress, owner);
  assert.equal(isParcelOwner(owner, wallet.snapshot, 31337), true);
  assert.equal(isParcelOwner(other, wallet.snapshot, 31337), false);
  fake.accounts([other]); assert.equal(wallet.snapshot.isConnected, false);
  await wallet.refresh(); assert.equal(wallet.snapshot.connectedAddress, other);
  fake.chain('0x1'); await wallet.refresh();
  assert.equal(isParcelOwner(other, wallet.snapshot, 31337), false);
  await assert.rejects(wallet.forChain(31337), /Switch your wallet/);
  wallet.disconnect(); fake.accounts([owner]); await wallet.refresh(); assert.equal(wallet.snapshot.isConnected, false);
  wallet.dispose(); assert.ok([...fake.handlers.values()].every(set => set.size === 0));
});
