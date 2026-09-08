import {BrowserProvider,Contract,JsonRpcProvider,formatEther,isAddress,hexlify,randomBytes,type TransactionReceipt} from 'ethers';
import abi from './OilField.json';
import oilABI from './Oil.json';
import {walletProvider} from './wallet';
export const oilFieldAddress=import.meta.env.VITE_OIL_FIELD_ADDRESS?.trim()||'';
export const oilConfigured=isAddress(oilFieldAddress)&&!/^0x0{40}$/i.test(oilFieldAddress);
let rpc:JsonRpcProvider|undefined;
function reader(){return rpc??=new JsonRpcProvider(import.meta.env.VITE_RPC_URL||'https://sepolia.base.org',84532)}
export const validId=(s:string)=>/^[1-9]\d{0,77}$/.test(s)&&BigInt(s)<2n**256n;
export type OilSnapshot={id:string;size:number;level:number;upgradeCost:number;owner:string;season:number;currentSeason:number;genesis:number;duration:number;timestamp:number;allocation:number;harvested:number;claimable:number;claimableWei:bigint;balance:number;requested:boolean;fulfilled:boolean;sequence:string;fee:bigint;provider:string};
export async function readOil(id:string,season:number|undefined,address?:string):Promise<OilSnapshot>{
 if(!oilConfigured)throw new Error('OilField v2 needs to be deployed and configured.');if(!validId(id))throw new Error('Enter a valid parcel ID.');
 const provider=reader();if((await provider.getNetwork()).chainId!==84532n)throw new Error('Oil RPC must be on Base Sepolia.');
 const block=await provider.getBlock('latest');if(!block)throw new Error('Base Sepolia is unavailable.');const options={blockTag:block.number};const field=new Contract(oilFieldAddress,abi,provider);
 const [owner,size,current,genesis,duration,fee,oil,entropyProvider]=await Promise.all([field.ownerOf(id,options),field.parcelSize(id,options),field.currentSeason(options),field.genesis(options),field.SEASON_DURATION(options),field.surveyFee(options),field.oil(options),field.entropyProvider(options)]);
 const selected=season??Number(current);if(!Number.isSafeInteger(selected)||selected<1||selected>Number(current))throw new Error('Choose an existing season.');
 const [reserve,claimable,balance,level,cost]=await Promise.all([field.reserves(id,selected,options),field.claimable(id,selected,options),address?new Contract(oil,oilABI,provider).balanceOf(address,options):Promise.resolve(0n),field.equipmentLevel(id,options),field.upgradeCost(id,options)]);
 return {id,level:Number(level),upgradeCost:Number(formatEther(cost)),size:Number(size),owner,season:selected,currentSeason:Number(current),genesis:Number(genesis)*1000,duration:Number(duration)*1000,timestamp:block.timestamp*1000,allocation:Number(formatEther(reserve.allocation)),harvested:Number(formatEther(reserve.harvested)),claimable:Number(formatEther(claimable)),claimableWei:claimable,balance:Number(formatEther(balance)),requested:reserve.requested,fulfilled:reserve.fulfilled,sequence:reserve.sequence.toString(),fee,provider:entropyProvider};
}
export async function oilTransaction(action:'mint'|'survey'|'harvest'|'upgrade',id:string,season:number,size:number,onSent:(hash:string)=>void){
 if(!oilConfigured)throw new Error('OilField v2 is not configured.');
 if(action!=='mint'&&(!validId(id)||!Number.isSafeInteger(season)||season<1))throw new Error('Invalid parcel or season.');
 const provider=new BrowserProvider(await walletProvider());if((await provider.getNetwork()).chainId!==84532n)throw new Error('Switch your wallet to Base Sepolia.');const signer=await provider.getSigner();const field=new Contract(oilFieldAddress,abi,signer);
 if(action!=='mint'&&(await field.ownerOf(id)).toLowerCase()!==(await signer.getAddress()).toLowerCase())throw new Error('Only the parcel owner can survey or harvest.');
 const fee=action==='survey'?await field.surveyFee():0n;
 const args=action==='mint'?[size]:action==='survey'?[id,season,hexlify(randomBytes(32))]:action==='upgrade'?[id]:[id,season];
 await field[action].staticCall(...args,{value:fee});const estimate=await field[action].estimateGas(...args,{value:fee});
 const tx=await field[action](...args,{value:fee,gasLimit:estimate*120n/100n+30000n});onSent(tx.hash);
 let receipt:TransactionReceipt|null;try{receipt=await tx.wait()}catch(e){const r=e as {code?:string;cancelled?:boolean;receipt?:TransactionReceipt};if(r.code==='TRANSACTION_REPLACED'&&!r.cancelled&&r.receipt)receipt=r.receipt;else throw e}
 if(!receipt||receipt.status!==1)throw new Error('Transaction did not complete.');let token=id;
 if(action==='mint'){for(const log of receipt.logs){if(log.address.toLowerCase()!==oilFieldAddress.toLowerCase())continue;try{const event=field.interface.parseLog(log);if(event?.name==='Transfer'&&event.args.from==='0x0000000000000000000000000000000000000000')token=event.args.tokenId.toString()}catch{}}}
 return {id:token,hash:receipt.hash};
}
export function oilError(error:unknown){const e=error as {code?:string;shortMessage?:string;message?:string;revert?:{name?:string}};if(e.code==='ACTION_REJECTED')return 'Wallet request cancelled.';const errors:Record<string,string>={AlreadyRequested:'This parcel already has a survey for that season. No rerolls.',IncorrectFee:'The Pyth fee changed. Refresh and try again.',WrongSeason:'The season changed. Select the current season.',FaucetLimit:'This wallet already minted, or that parcel size is sold out.',NothingToHarvest:'No unlocked oil is available yet.',NotOwner:'Only the current owner can use this parcel.'};return errors[e.revert?.name||'']||e.shortMessage||e.message||'Unable to complete the request.'}

export async function readDistrictParcel(id:number){
 if(!Number.isInteger(id)||id<1||id>1000)throw new Error('Invalid parcel ID.');
 if(!oilConfigured)throw new Error('OilField is not configured.');
 const rpc=reader();if((await rpc.getNetwork()).chainId!==84532n)throw new Error('Wrong network.');
 const field=new Contract(oilFieldAddress,abi,rpc);const p=await field.districtParcel(id);
 return {size:Number(p.size),owner:p.owner as string,level:Number(p.level),minted:p.owner!=='0x0000000000000000000000000000000000000000'};
}
