import {browser} from '$app/environment';
import {writable} from 'svelte/store';
import type {Eip1193Provider} from 'ethers';
export const wallet=writable<{address?:string;chainId?:number;connected:boolean}>({connected:false});
export const projectId=import.meta.env.VITE_PROJECT_ID?.trim() || 'd4db9e199d5c6e8ff5c465f9ce24aa7d';
let initialization:Promise<Awaited<ReturnType<typeof createModal>>>|undefined;
async function createModal(){
 const [{createAppKit},{EthersAdapter},{baseSepolia}]=await Promise.all([import('@reown/appkit'),import('@reown/appkit-adapter-ethers'),import('@reown/appkit/networks')]);
 const modal=createAppKit({adapters:[new EthersAdapter()],networks:[baseSepolia],defaultNetwork:baseSepolia,projectId,metadata:{name:'Cloudacre',description:'Evolving 3D testnet farm',url:window.location.origin,icons:[`${window.location.origin}/favicon.svg`]},features:{analytics:false,email:false,socials:false,onramp:false,swaps:false},themeMode:'light',themeVariables:{'--w3m-accent':'#365b42'}});
 modal.subscribeAccount(a=>wallet.update(w=>({...w,address:a.address,connected:a.isConnected??false})));
 modal.subscribeNetwork(n=>wallet.update(w=>({...w,chainId:n.chainId?Number(n.chainId):undefined})));
 return modal;
}
export function initWallet(){if(!browser||!projectId)throw new Error('A Reown project ID is needed to enable wallet connection.');return initialization??=createModal().catch(error=>{initialization=undefined;throw error})}
export async function connect(){await (await initWallet()).open()}
export async function walletProvider():Promise<Eip1193Provider>{const modal=await initWallet();const provider=modal.getWalletProvider() as Eip1193Provider|undefined;if(!provider)throw new Error('Connect your wallet first.');return provider}
export async function switchNetwork(){const modal=await initWallet();const {baseSepolia}=await import('@reown/appkit/networks');await modal.switchNetwork(baseSepolia)}

