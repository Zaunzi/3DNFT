// Doodverse additive public collections and external ERC-1155 custody (four contracts). Read-only simulation by default; --broadcast sends the reviewed plan.
// Load the existing signer with `node --env-file=.env scripts/deploy-doodverse.mjs`.
import fs from 'node:fs';
import {Contract,ContractFactory,Interface,JsonRpcProvider,Wallet,Transaction,getCreateAddress,formatEther,keccak256} from 'ethers';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let ganache;
try { ganache=require('ganache'); }
catch { ganache=require('../outputs/deployment-tools/node_modules/ganache'); }

const owner='0xdB6882db2a406bc1541988715842906dfd4fd590';
const runtime='https://atlas-mu-lime.vercel.app/';
const seed=7422026n;
const chainId=8453;
const rpc='https://mainnet.base.org';
const directory='deployments';
const planFile=`${directory}/doodverse-public-base-plan.json`;
const journalFile=`${directory}/doodverse-public-base-mainnet.json`;
const ceiling=400000000000000n; // 0.0004 ETH estimated total; fees rechecked before each send.
const provider=new JsonRpcProvider(rpc,chainId,{staticNetwork:true});
const artifact=name=>JSON.parse(fs.readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8'));
const save=(path,value)=>{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n');};

const land='0x383891F3537627Fb9E235f0242D874fe00Ca6443';
async function verify(addresses,client=provider){
 const equal=(a,b)=>{if(String(a).toLowerCase()!==String(b).toLowerCase())throw Error('Deployment configuration mismatch');};
 for(const [name,address]of Object.entries(addresses)){
  const a=artifact(name),code=await client.getCode(address);
  const normalize=hex=>{let value=hex.replace(/^0x/,'');for(const ranges of Object.values(a.deployedBytecode.immutableReferences??{}))for(const {start,length}of ranges)value=value.slice(0,start*2)+'0'.repeat(length*2)+value.slice((start+length)*2);return value.toLowerCase();};
  equal(normalize(code),normalize(a.deployedBytecode.object));
 }
 const c=name=>new Contract(addresses[name],artifact(name).abi,client);
 for(const name of ['DoodverseCharacters','DoodverseTrinkets']){equal(await c(name).owner(),owner);equal(await c(name).PUBLIC_MINT(),true);equal(await c(name).mintPaused(),false);}
 equal(await c('DoodverseCharacters').MAX_SUPPLY(),5000);equal(await c('DoodverseCharacters').MAX_PER_WALLET(),5);
 equal(await c('DoodverseCharacters').METADATA_BASE(),runtime+'cryptodoodz/metadata/');
 equal(await c('DoodverseTrinkets').metadataBaseURI(),runtime+'trinkets/metadata/');
 equal(await c('WorldEditionState').land(),land);equal(await c('WorldTrinketState').land(),land);equal(await c('WorldTrinketState').items(),addresses.DoodverseTrinkets);
}
async function makePlan(){
 const nonce=await provider.getTransactionCount(owner,'latest');if(await provider.getTransactionCount(owner,'pending')!==nonce)throw Error('Pending wallet transaction; wait before planning');
 const names=['WorldEditionState','DoodverseCharacters','DoodverseTrinkets','WorldTrinketState'];
 const addresses=Object.fromEntries(names.map((name,i)=>[name,getCreateAddress({from:owner,nonce:nonce+i})]));
 const args={WorldEditionState:[land],DoodverseCharacters:[owner],DoodverseTrinkets:[owner],WorldTrinketState:[land,addresses.DoodverseTrinkets]};
 const local=ganache.provider({chain:{chainId,hardfork:'shanghai'},wallet:{unlockedAccounts:[owner]},logging:{quiet:true},miner:{blockGasLimit:30000000}});
 const {BrowserProvider}=await import('ethers');const simulated=new BrowserProvider(local,chainId,{cacheTimeout:-1}),steps=[];
 try{
  await local.request({method:'evm_setAccountBalance',params:[owner,'0x56BC75E2D63100000']});await local.request({method:'evm_setAccountNonce',params:[owner,'0x'+nonce.toString(16)]});
  const landCode=await provider.getCode(land);if(landCode==='0x')throw Error('Parcel contract missing');
  // Constructors need the existing land code and store its address; no land state is mutated.
  await local.request({method:'evm_setAccountCode',params:[land,landCode]});
  for(const [i,name]of names.entries()){
   const a=artifact(name),request=await new ContractFactory(a.abi,a.bytecode.object).getDeployTransaction(...args[name]);
   const gas=await simulated.estimateGas({...request,from:owner}),gasLimit=gas*125n/100n;
   const hash=await local.request({method:'eth_sendTransaction',params:[{from:owner,data:request.data,gas:'0x'+gasLimit.toString(16)}]});
   const receipt=await simulated.waitForTransaction(hash);if(receipt.status!==1||receipt.contractAddress.toLowerCase()!==addresses[name].toLowerCase())throw Error('Simulation failed: '+name);
   steps.push({name,nonce:nonce+i,data:request.data,address:addresses[name],gas:String(gas),gasLimit:String(gasLimit)});
  }
  await verify(addresses,simulated);
 }finally{await simulated.destroy();await local.disconnect();}
 return {chainId,owner,land,runtime,minting:'none',constructorArgs:args,startingNonce:nonce,addresses,steps};
}
async function feeQuote(step){
  const fees=await provider.getFeeData();if(!fees.maxFeePerGas)throw Error('Fee quote unavailable');
  const transaction={type:2,chainId,nonce:step.nonce,data:step.data,value:0n,gasLimit:BigInt(step.gasLimit),maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas??0n,...(step.to?{to:step.to}:{})};
  const unsigned=Transaction.from(transaction).unsignedSerialized;
  const oracle=new Contract('0x420000000000000000000000000000000000000F',['function getL1Fee(bytes) view returns(uint256)','function getOperatorFee(uint256) view returns(uint256)'],provider);
  const l1=await oracle.getL1Fee(unsigned);
  const operator=await oracle.getOperatorFee(transaction.gasLimit);
  const l2=transaction.gasLimit*transaction.maxFeePerGas;
  return {transaction,l1,l2,operator,total:l1+l2+operator};
}
async function main(){
  if(BigInt(await provider.send('eth_chainId',[]))!==8453n)throw Error('Wrong chain');
  const key=process.env.DEPLOY_PRIVATE_KEY;if(!key)throw Error('Deployment signer missing');
  const wallet=new Wallet(key,provider);if(wallet.address.toLowerCase()!==owner.toLowerCase())throw Error('Signer does not match authorized owner');
  if(process.argv.includes('--verify')){const journal=JSON.parse(fs.readFileSync(journalFile,'utf8'));await verify(journal.addresses);console.log('All deployed Atlas roles and bindings verified.');return;}
  let journal=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile,'utf8')):null;
  if(journal?.status==='confirmed'){await verify(journal.addresses);console.log('Existing verified deployment; no duplicate created.');return;}
  let plan;
  if(journal){plan=JSON.parse(fs.readFileSync(planFile,'utf8'));if(journal.planHash!==keccak256(Buffer.from(JSON.stringify(plan))))throw Error('Deployment plan changed; refusing resume');}
  else{plan=await makePlan();save(planFile,plan);}
  const quotes=[];for(const step of plan.steps)quotes.push(await feeQuote(step));
  const estimated=quotes.reduce((sum,q)=>sum+q.total,0n);
  const balance=await provider.getBalance(owner);
  console.log(JSON.stringify({chainId,owner,runtime,minting:'none',contracts:plan.addresses,transactions:plan.steps.length,estimatedMaximumL2AndCurrentL1ETH:formatEther(estimated),estimatedCostCeilingETH:formatEther(ceiling),balanceETH:formatEther(balance),mode:process.argv.includes('--broadcast')?'broadcast':'simulation'},null,2));
  if(estimated>ceiling||balance<estimated*125n/100n)throw Error('Cost or balance guard failed');
  if(!process.argv.includes('--broadcast'))return;
  if(!journal){journal={chainId,owner,runtime,seed:String(seed),minting:'none',addresses:plan.addresses,planHash:keccak256(Buffer.from(JSON.stringify(plan))),status:'deploying',transactions:[]};save(journalFile,journal);}
  let projectedSpent=0n;
  for(const step of plan.steps){
    let entry=journal.transactions.find(t=>t.nonce===step.nonce);
    if(entry?.status==='confirmed'){projectedSpent+=BigInt(entry.estimatedFeeWei);continue;}
    if(entry)projectedSpent+=BigInt(entry.estimatedFeeWei);
    if(!entry){
      if(await provider.getTransactionCount(owner,'pending')!==step.nonce)throw Error('Wallet nonce changed; do not create a new deployment plan');
      const quote=await feeQuote(step);projectedSpent+=quote.total;if(projectedSpent>ceiling)throw Error('Cumulative fee guard reached');
      const estimate=await provider.estimateGas({...quote.transaction,from:owner});if(estimate>quote.transaction.gasLimit)throw Error('Live gas estimate exceeds reviewed gas limit');
      const raw=await wallet.signTransaction(quote.transaction);entry={name:step.name,nonce:step.nonce,hash:keccak256(raw),raw,estimatedFeeWei:quote.total.toString(),status:'prepared'};journal.transactions.push(entry);save(journalFile,journal);
    }
    let receipt=await provider.getTransactionReceipt(entry.hash);
    if(!receipt){const known=await provider.getTransaction(entry.hash);if(!known)await provider.broadcastTransaction(entry.raw);console.log(`Submitted ${step.name}: ${entry.hash}`);receipt=await provider.waitForTransaction(entry.hash,2,180000);}
    if(!receipt||receipt.status!==1)throw Error(`Transaction pending or reverted: ${step.name}; inspect the journal before resuming`);
    entry.status='confirmed';entry.blockNumber=receipt.blockNumber;entry.gasUsed=receipt.gasUsed.toString();delete entry.raw;save(journalFile,journal);console.log(`Confirmed ${step.name}: ${step.address??step.to}`);
  }
  await verify(plan.addresses);journal.status='confirmed';save(journalFile,journal);
  const report={chainId,owner,land,addresses:plan.addresses,constructorArgs:plan.constructorArgs,transactions:journal.transactions.map(({name,hash,blockNumber,gasUsed})=>({name,hash,blockNumber,gasUsed})),minting:'none'};
  fs.writeFileSync('docs/deployments/doodverse-public-base-mainnet.json',JSON.stringify(report,null,2)+'\n');
  console.log('Four deployments confirmed and bytecode/bindings verified.');
}
main().catch(error=>{console.error(error?.shortMessage??(error instanceof Error?error.message.split('\n')[0]:'Deployment failed'));process.exitCode=1;}).finally(()=>provider.destroy());
