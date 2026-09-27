// Atlas mainnet deployment. Read-only simulation by default; --broadcast sends the reviewed plan.
// Load the existing signer with `node --env-file=.env scripts/deploy-atlas.mjs`.
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
const planFile=`${directory}/atlas-base-plan.json`;
const journalFile=`${directory}/atlas-base-mainnet.json`;
const ceiling=400000000000000n; // 0.0004 ETH estimated total; fees rechecked before each send.
const provider=new JsonRpcProvider(rpc,chainId,{staticNetwork:true});
const artifact=name=>JSON.parse(fs.readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8'));
const save=(path,value)=>{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n');};

async function verify(addresses,client=provider,bound=true){
  const contract=name=>new Contract(addresses[name],artifact(name).abi,client);
  const equal=(a,b,label)=>{if(String(a).toLowerCase()!==String(b).toLowerCase())throw Error(`Configuration mismatch: ${label}`);};
  for(const name of Object.keys(addresses)){
    const a=artifact(name),code=await client.getCode(addresses[name]);
    const normalize=hex=>{let value=hex.replace(/^0x/,'');for(const ranges of Object.values(a.deployedBytecode.immutableReferences??{}))for(const {start,length} of ranges)value=value.slice(0,start*2)+'0'.repeat(length*2)+value.slice((start+length)*2);return value.toLowerCase();};
    if(normalize(code)!==normalize(a.deployedBytecode.object))throw Error(`Runtime bytecode mismatch: ${name}`);
  }
  const land=contract('WorldParcelNFT');equal(await land.owner(),owner,'land owner');equal(await land.collectionSeed(),seed,'seed');equal(await land.MAX_SUPPLY(),5000,'supply');equal(await land.runtimeURL(),runtime,'runtime');
  for(const name of ['ParcelState','WorldItemState','PortalState','WorldNFTState'])equal(await contract(name).land(),addresses.WorldParcelNFT,`${name}.land`);
  for(const name of ['AtlasItems','AtlasCharacters','WorldNFTState'])equal(await contract(name).owner(),owner,`${name}.owner`);
  equal(await contract('WorldItemState').items(),addresses.AtlasItems,'world items');
  equal(await contract('ContainerItemState').world(),addresses.WorldNFTState,'container world');
  equal(await contract('ContainerItemState').items(),addresses.AtlasItems,'container items');
  if(bound)equal(await contract('WorldNFTState').containerItems(),addresses.ContainerItemState,'bound container custody');
}

async function makePlan(){
  const nonce=await provider.getTransactionCount(owner,'latest');
  if(await provider.getTransactionCount(owner,'pending')!==nonce)throw Error('Wait for existing wallet transactions before planning.');
  const names=['WorldParcelNFT','ParcelState','AtlasItems','WorldItemState','PortalState','WorldNFTState','ContainerItemState','AtlasCharacters'];
  const addresses=Object.fromEntries(names.map((name,i)=>[name,getCreateAddress({from:owner,nonce:nonce+i})]));
  const args={WorldParcelNFT:[seed,runtime,owner],ParcelState:[addresses.WorldParcelNFT],AtlasItems:[owner,`${runtime}metadata/items/{id}.json`],WorldItemState:[addresses.WorldParcelNFT,addresses.AtlasItems],PortalState:[addresses.WorldParcelNFT],WorldNFTState:[addresses.WorldParcelNFT,owner],ContainerItemState:[addresses.WorldNFTState,addresses.AtlasItems],AtlasCharacters:[owner]};
  const steps=[];
  for(const [i,name] of names.entries()){
    const a=artifact(name),tx=await new ContractFactory(a.abi,a.bytecode.object).getDeployTransaction(...args[name]);
    steps.push({name,nonce:nonce+i,data:tx.data,address:addresses[name]});
  }
  steps.push({name:'Bind container custody',nonce:nonce+8,to:addresses.WorldNFTState,data:new Interface(artifact('WorldNFTState').abi).encodeFunctionData('bindContainerItems',[addresses.ContainerItemState])});
  // Simulate all nine transactions together so constructor dependencies and custody binding are checked.
  const local=ganache.provider({chain:{chainId,hardfork:'shanghai'},wallet:{unlockedAccounts:[owner]},logging:{quiet:true},miner:{blockGasLimit:30000000}});
  const {BrowserProvider}=await import('ethers');const simulated=new BrowserProvider(local,chainId,{cacheTimeout:-1});
  try{
    await local.request({method:'evm_setAccountBalance',params:[owner,'0x56BC75E2D63100000']});
    await local.request({method:'evm_setAccountNonce',params:[owner,`0x${nonce.toString(16)}`]});
    for(const step of steps){const tx={from:owner,data:step.data,...(step.to?{to:step.to}:{})};const gas=await simulated.estimateGas(tx);step.gas=gas.toString();step.gasLimit=(gas*125n/100n).toString();const hash=await local.request({method:'eth_sendTransaction',params:[{...tx,gas:`0x${BigInt(step.gasLimit).toString(16)}`} ]});const receipt=await simulated.waitForTransaction(hash);if(receipt.status!==1)throw Error(`Local simulation failed: ${step.name}`);if(step.address&&receipt.contractAddress.toLowerCase()!==step.address.toLowerCase())throw Error('Predicted address mismatch');}
    await verify(addresses,simulated);
  }finally{await simulated.destroy();await local.disconnect();}
  return {chainId,owner,runtime,seed:String(seed),minting:'none',startingNonce:nonce,addresses,steps};
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
  if(estimated>ceiling||balance<estimated*2n)throw Error('Cost or balance guard failed');
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
  const env=`VITE_WORLD_STATE_MODE=onchain\nVITE_CHAIN_ID=8453\nVITE_RPC_URL=${rpc}\nVITE_WORLD_PARCEL_NFT_ADDRESS=${plan.addresses.WorldParcelNFT}\nVITE_PARCEL_STATE_ADDRESS=${plan.addresses.ParcelState}\nVITE_ATLAS_ITEMS_ADDRESS=${plan.addresses.AtlasItems}\nVITE_WORLD_ITEM_STATE_ADDRESS=${plan.addresses.WorldItemState}\nVITE_PORTAL_STATE_ADDRESS=${plan.addresses.PortalState}\nVITE_WORLD_NFT_STATE_ADDRESS=${plan.addresses.WorldNFTState}\nVITE_CONTAINER_ITEM_STATE_ADDRESS=${plan.addresses.ContainerItemState}\nVITE_ATLAS_CHARACTERS_ADDRESS=${plan.addresses.AtlasCharacters}\nVITE_IPFS_GATEWAY=https://ipfs.io/ipfs/\n`;
  fs.writeFileSync(`${directory}/atlas-base.env`,env);console.log('Deployment verified. Frontend configuration: deployments/atlas-base.env');
}
main().catch(error=>{console.error(error?.shortMessage??(error instanceof Error?error.message.split('\n')[0]:'Deployment failed'));process.exitCode=1;}).finally(()=>provider.destroy());
