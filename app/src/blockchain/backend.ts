import { readConfig } from './config.ts';
import { InjectedWallet, type InjectedProvider, type WalletSession } from './wallet.ts';
import { MockWallet } from './mockWallet.ts';
import { MockWorldState, type WorldStateProvider } from './state.ts';
import { MockParcelStateProvider } from './mockParcelState.ts';
import { isParcelOwner } from './ownership.ts';
import type { ParcelStateStore } from './parcelState.ts';
import { MockInventoryProvider } from '../items/mockInventory.ts';
import type { ExperienceStore } from '../items/providers.ts';
import { getAddress } from 'viem';
import { MockNFTProvider } from '../nfts/mock.ts';
import type { NFTStateProvider } from '../nfts/model.ts';
export async function createBackend(env: Record<string, string | undefined>) {
  const config = readConfig(env);
  let wallet: WalletSession, world: WorldStateProvider, objects: ParcelStateStore, experience: ExperienceStore, nfts:NFTStateProvider;
  let transferMockParcel:((id:number,to:string)=>Promise<void>)|undefined;
  if (config.mode === 'mock') {
    wallet = new MockWallet(config.mockAddress, config.chainId);
    const ownerKey='atlas:7422026:owners:v1';
    const ownerFor = (id: number) => getAddress((JSON.parse(window.localStorage.getItem(ownerKey)??'{}') as Record<string,string>)[id]??(config.mockParcels.has(id) ? config.mockAddress : '0x2222222222222222222222222222222222222222'));
    transferMockParcel=async(id,to)=>{if(!isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId))throw new Error('Only the current owner may transfer land');const owners=JSON.parse(window.localStorage.getItem(ownerKey)??'{}');owners[id]=getAddress(to);window.localStorage.setItem(ownerKey,JSON.stringify(owners));};
    world = new MockWorldState(ownerFor);
    objects = new MockParcelStateProvider({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) }, id => isParcelOwner(ownerFor(id), wallet.snapshot, config.chainId));
    experience = new MockInventoryProvider({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},()=>wallet.snapshot.connectedAddress,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId));
    nfts=new MockNFTProvider(experience as MockInventoryProvider,config.chainId,config.mockAddress,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId));
  } else {
    const injected = new InjectedWallet((window as Window & { ethereum?: InjectedProvider }).ethereum);
    wallet = injected;
    const { OnchainParcelStateProvider } = await import('./client.ts');
    const provider = new OnchainParcelStateProvider(config.rpc!, config.land!, config.state, config.chainId, injected);
    world = provider; objects = provider;
    const { OnchainInventoryProvider } = await import('../items/onchainInventory.ts');
    const inventory = new OnchainInventoryProvider(provider.client,injected,{land:config.land!,items:env.VITE_ATLAS_ITEMS_ADDRESS?getAddress(env.VITE_ATLAS_ITEMS_ADDRESS):undefined,worldItems:env.VITE_WORLD_ITEM_STATE_ADDRESS?getAddress(env.VITE_WORLD_ITEM_STATE_ADDRESS):undefined,portals:env.VITE_PORTAL_STATE_ADDRESS?getAddress(env.VITE_PORTAL_STATE_ADDRESS):undefined});
    await inventory.validateDeployment(); experience=inventory;
    const {OnchainNFTProvider}=await import('../nfts/onchain.ts');
    const nftProvider=new OnchainNFTProvider(provider.client,injected,{land:config.land!,world:env.VITE_WORLD_NFT_STATE_ADDRESS?getAddress(env.VITE_WORLD_NFT_STATE_ADDRESS):undefined,containers:env.VITE_CONTAINER_ITEM_STATE_ADDRESS?getAddress(env.VITE_CONTAINER_ITEM_STATE_ADDRESS):undefined,items:env.VITE_ATLAS_ITEMS_ADDRESS?getAddress(env.VITE_ATLAS_ITEMS_ADDRESS):undefined,characters:env.VITE_ATLAS_CHARACTERS_ADDRESS?getAddress(env.VITE_ATLAS_CHARACTERS_ADDRESS):undefined});await nftProvider.validateDeployment();nfts=nftProvider;
  }
  return { config, wallet, world, objects, experience, nfts, transferMockParcel, supportsBuild: config.mode === 'mock' || !!config.state };
}
