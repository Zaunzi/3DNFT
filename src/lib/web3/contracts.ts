import {BrowserProvider,Contract,JsonRpcProvider,formatEther,isAddress,type TransactionReceipt} from 'ethers';
import landABI from './Cloudacre.json';
import seedABI from './Seed.json';
import {walletProvider} from './wallet';
export const landAddress=import.meta.env.VITE_LAND_ADDRESS?.trim()??'';
export const configured=isAddress(landAddress)&&!/^0x0{40}$/i.test(landAddress);
export const chainId=84532;
const rpcUrl=import.meta.env.VITE_RPC_URL||'https://sepolia.base.org';
let rpc:JsonRpcProvider|undefined;
function reader(){return rpc??=new JsonRpcProvider(rpcUrl,chainId,{staticNetwork:true})}
export type Snapshot={id:string;owner:string;level:number;stored:number;balance:number;balanceWei:bigint;pendingWei:bigint;updated:number;block:number;seed:string};
export function validToken(value:string){return /^[1-9]\d{0,77}$/.test(value)&&BigInt(value)<2n**256n}
export async function readLand(id:string,address?:string):Promise<Snapshot>{
 if(!configured)throw new Error('Testnet contracts are not configured yet.');if(!validToken(id))throw new Error('Enter a valid positive token ID.');
 const provider=reader();const block=await provider.getBlock('latest');if(!block)throw new Error('Unable to read Base Sepolia.');const overrides={blockTag:block.number};
 const land=new Contract(landAddress,landABI,provider);
 const [owner,plot,pending,seed]=await Promise.all([land.ownerOf(id,overrides),land.plots(id,overrides),land.pending(id,overrides),land.seed(overrides)]);
 const balance=address?await new Contract(seed,seedABI,provider).balanceOf(address,overrides):0n;
 return {id,owner,level:Number(plot.level),stored:Number(formatEther(pending)),balance:Number(formatEther(balance)),balanceWei:balance,pendingWei:pending,updated:block.timestamp*1000,block:block.number,seed};
}
export async function transact(action:'mint'|'harvest'|'upgrade',id:string,onSent:(hash:string)=>void):Promise<{receipt:TransactionReceipt;id:string}>{
 if(!configured)throw new Error('Testnet contracts are not configured yet.');
 if(action!=='mint'&&!validToken(id))throw new Error('Invalid token ID.');
 const provider=new BrowserProvider(await walletProvider());if((await provider.getNetwork()).chainId!==BigInt(chainId))throw new Error('Switch your wallet to Base Sepolia.');
 const signer=await provider.getSigner();const land=new Contract(landAddress,landABI,signer);
 if(action!=='mint'&&(await land.ownerOf(id)).toLowerCase()!==(await signer.getAddress()).toLowerCase())throw new Error('Only the current land owner can harvest or upgrade.');
 const args=action==='mint'?[]:[id];await land[action].staticCall(...args);
 const estimate=await land[action].estimateGas(...args);
 const tx=await land[action](...args,{gasLimit:estimate*120n/100n+30000n});onSent(tx.hash);
 let receipt:TransactionReceipt|null;
 try{receipt=await tx.wait()}catch(e){const r=e as {code?:string;cancelled?:boolean;receipt?:TransactionReceipt};if(r.code==='TRANSACTION_REPLACED'&&!r.cancelled&&r.receipt)receipt=r.receipt;else throw e}
 if(!receipt||receipt.status!==1)throw new Error('Transaction did not complete successfully.');
 let minted=id;if(action==='mint'){for(const log of receipt.logs){if(log.address.toLowerCase()!==landAddress.toLowerCase())continue;try{const parsed=land.interface.parseLog(log);if(parsed?.name==='Transfer'&&parsed.args.from==='0x0000000000000000000000000000000000000000')minted=parsed.args.tokenId.toString()}catch{}}}
 return {receipt,id:minted};
}
export function explain(error:unknown){const e=error as {code?:string;shortMessage?:string;message?:string;revert?:{name?:string}};if(e.code==='ACTION_REJECTED')return 'You cancelled the wallet request.';const name=e.revert?.name;if(name==='FaucetLimit')return 'This wallet has already minted its test land, or the faucet is full.';if(name==='FullyUpgraded')return 'This land is fully upgraded.';if(name==='NothingToHarvest')return 'There is nothing to harvest yet.';return e.shortMessage||e.message||'Something went wrong. Try again.'}

