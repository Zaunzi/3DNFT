// Deploy only the additive Trinket escrow. Existing contracts and balances are untouched.
// `node --env-file=.env scripts/deploy-trinket-state.mjs` estimates; add --broadcast to deploy.
import fs from 'node:fs';
import {Contract,ContractFactory,JsonRpcProvider,Wallet,getCreateAddress,keccak256,formatEther} from 'ethers';
const provider=new JsonRpcProvider('https://mainnet.base.org',8453,{staticNetwork:true});
const owner='0xdB6882db2a406bc1541988715842906dfd4fd590';
const land='0x383891F3537627Fb9E235f0242D874fe00Ca6443',items='0x32CEb50081fD7e986cd32231b01157b45FD20B51';
const file='deployments/world-trinket-state.json';
const artifact=JSON.parse(fs.readFileSync('contracts/out/WorldTrinketState.sol/WorldTrinketState.json','utf8'));
const wallet=new Wallet(process.env.DEPLOY_PRIVATE_KEY,provider);
if(wallet.address.toLowerCase()!==owner.toLowerCase())throw Error('Unexpected deployer');
if(Number((await provider.getNetwork()).chainId)!==8453)throw Error('Wrong chain');
async function verify(address){
 const c=new Contract(address,artifact.abi,provider);
 if((await c.land()).toLowerCase()!==land.toLowerCase()||(await c.items()).toLowerCase()!==items.toLowerCase())throw Error('Binding mismatch');
 const normalize=hex=>{let value=hex.replace(/^0x/,'');for(const ranges of Object.values(artifact.deployedBytecode.immutableReferences??{}))for(const {start,length} of ranges)value=value.slice(0,start*2)+'0'.repeat(length*2)+value.slice((start+length)*2);return value.toLowerCase();};
 if(normalize(await provider.getCode(address))!==normalize(artifact.deployedBytecode.object))throw Error('Runtime bytecode mismatch');
}
let journal=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
const save=()=>{fs.mkdirSync('deployments',{recursive:true});fs.writeFileSync(file,JSON.stringify(journal,null,2)+'\n');};
if(journal?.status==='confirmed'){await verify(journal.address);console.log(JSON.stringify({address:journal.address,status:'already confirmed'}));process.exit(0);}
if(!journal){
 const request=await new ContractFactory(artifact.abi,artifact.bytecode.object,wallet).getDeployTransaction(land,items);
 const gas=(await provider.estimateGas({...request,from:wallet.address}))*120n/100n,fees=await provider.getFeeData();
 const maxFee=fees.maxFeePerGas,tip=fees.maxPriorityFeePerGas;
 if(!maxFee||tip===null||gas*maxFee>50000000000000n)throw Error('Estimated execution fee exceeds 0.00005 ETH ceiling');
 console.log(JSON.stringify({contract:'WorldTrinketState',land,items,gasLimit:String(gas),maximumExecutionFeeETH:formatEther(gas*maxFee)}));
 if(!process.argv.includes('--broadcast'))process.exit(0);
 const nonce=await provider.getTransactionCount(wallet.address,'pending');
 const raw=await wallet.signTransaction({...request,chainId:8453,type:2,nonce,gasLimit:gas,maxFeePerGas:maxFee,maxPriorityFeePerGas:tip});
 journal={status:'signed',address:getCreateAddress({from:wallet.address,nonce}),hash:keccak256(raw),raw};save();
}
if(!process.argv.includes('--broadcast')){console.log({address:journal.address,status:journal.status});process.exit(0);}
let receipt=await provider.getTransactionReceipt(journal.hash);
if(!receipt){if(!await provider.getTransaction(journal.hash))await provider.broadcastTransaction(journal.raw);receipt=await provider.waitForTransaction(journal.hash,1,180000);}
if(!receipt||receipt.status!==1)throw Error('Transaction pending or failed: '+journal.hash);
await verify(journal.address);journal.status='confirmed';delete journal.raw;save();
const report={chainId:8453,contract:'WorldTrinketState',address:journal.address,land,items,transactionHash:receipt.hash,blockNumber:receipt.blockNumber,executionFeeETH:formatEther(receipt.fee)};
fs.writeFileSync('docs/deployments/world-trinket-state-base.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
