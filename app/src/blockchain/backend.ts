import type {EditionProvider} from '../editions/model.ts';
import {MockEconomy} from '../economy/mock.ts';
import type {HarvestProvider} from '../economy/model.ts';
import { readConfig } from './config.ts';
import { InjectedWallet, type InjectedProvider, type WalletSession } from './wallet.ts';
import { MockWallet } from './mockWallet.ts';
import { MockWorldState, type WorldStateProvider } from './state.ts';
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
  let trinkets:ExperienceStore;
  let editions:EditionProvider;
  let economy:HarvestProvider|undefined;
  let transferMockParcel:((id:number,to:string)=>Promise<void>)|undefined;
  if (config.mode === 'mock') {
    wallet = new MockWallet(config.mockAddress, config.chainId);
    const ownerKey='atlas:7422026:owners:v1';
    const epochFor=(id:number)=>Number(JSON.parse(window.localStorage.getItem(ownerKey)??'{}')[`epoch:${id}`]??0);
    const ownerFor = (id: number) => getAddress((JSON.parse(window.localStorage.getItem(ownerKey)??'{}') as Record<string,string>)[id]??(config.mockParcels.has(id) ? config.mockAddress : '0x2222222222222222222222222222222222222222'));
    transferMockParcel=async(id,to)=>{if(!isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId))throw new Error('Only the current owner may transfer land');const owners=JSON.parse(window.localStorage.getItem(ownerKey)??'{}');if(ownerFor(id).toLowerCase()!==to.toLowerCase())owners[`epoch:${id}`]=epochFor(id)+1;owners[id]=getAddress(to);window.localStorage.setItem(ownerKey,JSON.stringify(owners));};
    world = new MockWorldState(ownerFor);
    experience = new MockInventoryProvider({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},()=>wallet.snapshot.connectedAddress,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId));
    const economyStore=new MockEconomy(experience as MockInventoryProvider,window.localStorage,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId));objects=economyStore;economy=economyStore;
    const {MockTrinketProvider}=await import('../trinkets/mock.ts');
    trinkets=new MockTrinketProvider({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},()=>wallet.snapshot.connectedAddress,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId));
    const {MockEditionProvider}=await import('../editions/mock.ts');
    editions=new MockEditionProvider(window.localStorage,()=>wallet.snapshot.connectedAddress,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId),config.chainId,config.mockAddress);
    nfts=new MockNFTProvider(experience as MockInventoryProvider,config.chainId,config.mockAddress,id=>isParcelOwner(ownerFor(id),wallet.snapshot,config.chainId),ownerFor,epochFor);
  } else {
    const injected = new InjectedWallet((window as Window & { ethereum?: InjectedProvider }).ethereum);
    wallet = injected;
    const { OnchainParcelStateProvider } = await import('./client.ts');
    const provider = new OnchainParcelStateProvider(config.rpc!, config.land!, config.state, config.chainId, injected);
    world = provider; objects = provider;
    const {OnchainEditionProvider}=await import('../editions/onchain.ts');
    const editionProvider=new OnchainEditionProvider(provider.client,injected,config.land!,env.VITE_WORLD_EDITION_STATE_ADDRESS?getAddress(env.VITE_WORLD_EDITION_STATE_ADDRESS):undefined);
    await editionProvider.validateDeployment();editions=editionProvider;
    await provider.getWorld();
    const { OnchainInventoryProvider } = await import('../items/onchainInventory.ts');
    const inventory = new OnchainInventoryProvider(provider.client,injected,{land:config.land!,items:env.VITE_ATLAS_ITEMS_ADDRESS?getAddress(env.VITE_ATLAS_ITEMS_ADDRESS):undefined,worldItems:env.VITE_WORLD_ITEM_STATE_ADDRESS?getAddress(env.VITE_WORLD_ITEM_STATE_ADDRESS):undefined,portals:env.VITE_PORTAL_STATE_ADDRESS?getAddress(env.VITE_PORTAL_STATE_ADDRESS):undefined});
    await inventory.validateDeployment(); experience=inventory;
    const {OnchainTrinketProvider}=await import('../trinkets/onchain.ts');
    const trinketProvider=new OnchainTrinketProvider(provider.client,injected,{land:config.land!,items:env.VITE_DOODVERSE_TRINKETS_ADDRESS?getAddress(env.VITE_DOODVERSE_TRINKETS_ADDRESS):undefined,worldItems:env.VITE_WORLD_TRINKET_STATE_ADDRESS?getAddress(env.VITE_WORLD_TRINKET_STATE_ADDRESS):undefined});
    await trinketProvider.validateDeployment();trinkets=trinketProvider;
    const {OnchainNFTProvider}=await import('../nfts/onchain.ts');
    const nftProvider=new OnchainNFTProvider(provider.client,injected,{land:config.land!,world:env.VITE_WORLD_NFT_STATE_ADDRESS?getAddress(env.VITE_WORLD_NFT_STATE_ADDRESS):undefined,containers:env.VITE_CONTAINER_ITEM_STATE_ADDRESS?getAddress(env.VITE_CONTAINER_ITEM_STATE_ADDRESS):undefined,items:env.VITE_ATLAS_ITEMS_ADDRESS?getAddress(env.VITE_ATLAS_ITEMS_ADDRESS):undefined,characters:env.VITE_ATLAS_CHARACTERS_ADDRESS?getAddress(env.VITE_ATLAS_CHARACTERS_ADDRESS):undefined});await nftProvider.validateDeployment();nfts=nftProvider;
    if(env.VITE_ART_MOUNTS_ADDRESS){
      const {OnchainArtMounts}=await import('../nfts/mountState.ts');
      const mounts=new OnchainArtMounts(provider.client,injected,getAddress(env.VITE_ART_MOUNTS_ADDRESS));
      await mounts.validate({land:config.land!,parcels:config.state!,nfts:getAddress(env.VITE_WORLD_NFT_STATE_ADDRESS!),editions:getAddress(env.VITE_WORLD_EDITION_STATE_ADDRESS!)});
      nftProvider.mounts=mounts;editionProvider.mounts=mounts;
    }

  }
  return { editions, economy, config, wallet, world, objects, experience, trinkets, nfts, transferMockParcel, supportsModular:config.mode==='mock'||('schemaVersion' in objects&&objects.schemaVersion===2), supportsElevatedDoors:config.mode==='mock'||('schemaVersion' in nfts&&nfts.schemaVersion===2), supportsBuild: config.mode === 'mock' || !!config.state };
}
