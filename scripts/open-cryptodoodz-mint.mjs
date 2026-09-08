import fs from 'node:fs';
import {JsonRpcProvider,Wallet,Contract,formatEther} from 'ethers';
const expected='0xdb6882db2a406bc1541988715842906dfd4fd590';
const file='deployments/cryptodoodz-base-mainnet.json';
const site='static/cryptodoodz/contract.json';
const uri='https://3dnft.vercel.app/cryptodoodz/metadata/';
const sample=uri+'0001.json';
function fail(message){throw Error(message);}
async function estimate(provider,from,tx,fees){
 const gas=await provider.estimateGas({...tx,from});
 const gasLimit=gas*125n/100n;
 const maxFeePerGas=fees.maxFeePerGas;
 if(!maxFeePerGas)fail('No gas price available');
 return {gas:gas.toString(),gasLimit,maxL2GasETH:formatEther(gasLimit*maxFeePerGas)};
}
async function main(){
 let wallet;try{wallet=new Wallet(process.env.DEPLOY_PRIVATE_KEY);}catch{fail('DEPLOY_PRIVATE_KEY is missing or invalid; key was not displayed.');}
 if(wallet.address.toLowerCase()!==expected)fail('Deployment key does not match the authorized wallet.');
 if(!fs.existsSync(file))fail('Missing deployment record.');
 const record=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!record.address)fail('Deployment record has no address.');
 const meta=await fetch(sample);if(!meta.ok)fail('Metadata URL is not reachable; refusing to open mint.');
 const json=await meta.json();if(json.name!=='CryptoDoodz #0001'||!String(json.image||'').startsWith('https://3dnft.vercel.app/cryptodoodz/images/'))fail('Metadata payload does not match the expected CryptoDoodz sample.');
 const provider=new JsonRpcProvider('https://mainnet.base.org',8453,{staticNetwork:true});
 if(BigInt(await provider.send('eth_chainId',[]))!==8453n)fail('Wrong chain');
 wallet=wallet.connect(provider);
 const a=JSON.parse(fs.readFileSync('artifacts/CryptoDoodz.json'));
 const c=new Contract(record.address,a.abi,wallet);
 const [owner,open,base,frozen,code,balance,fees]=await Promise.all([c.owner(),c.mintOpen(),c.baseTokenURI(),c.metadataFrozen(),provider.getCode(record.address),provider.getBalance(wallet.address),provider.getFeeData()]);
 if(owner.toLowerCase()!==expected)fail('On-chain owner mismatch');
 if(code!==a.deployedBytecode)fail('Runtime bytecode mismatch');
 if(frozen&&base!==uri)fail('Metadata is frozen to a different URI.');
 const needUri=base!==uri;const needOpen=!open;
 if(!needUri&&!needOpen){console.log(JSON.stringify({address:record.address,owner,baseTokenURI:base,mintOpen:open,mode:'already-configured'}));return;}
 if(needUri&&frozen)fail('Metadata is frozen.');
 const maxFeePerGas=fees.maxFeePerGas;if(!maxFeePerGas)fail('No gas price available');
 const steps=[];
 if(needUri){const tx=await c.setBaseURI.populateTransaction(uri);const gas=await estimate(provider,wallet.address,tx,fees);steps.push({name:'setBaseURI',tx,...gas});}
 if(needOpen){
  const tx=await c.setMintOpen.populateTransaction(true);
  // setMintOpen reverts until baseTokenURI is set, so skip live estimate when URI still empty.
  steps.push(needUri?{name:'setMintOpen',tx,gas:'deferred',gasLimit:80000n,maxL2GasETH:formatEther(80000n*maxFeePerGas)}:{name:'setMintOpen',tx,...await estimate(provider,wallet.address,tx,fees)});
 }
 const maximumL2=steps.reduce((sum,item)=>sum+item.gasLimit,0n)*maxFeePerGas;
 if(maximumL2>500000000000000n)fail('Estimated L2 cost exceeds conservative 0.0005 ETH ceiling.');
 if(balance<maximumL2+100000000000000n)fail('Insufficient Base ETH for owner calls plus L1 fee buffer.');
 console.log(JSON.stringify({wallet:wallet.address,chainId:8453,address:record.address,baseTokenURI:uri,mintOpen:true,currentBaseTokenURI:base,currentMintOpen:open,balanceETH:formatEther(balance),maxL2GasETH:formatEther(maximumL2),steps:steps.map(({name,gas,gasLimit,maxL2GasETH})=>({name,gas,gasLimit:gasLimit.toString(),maxL2GasETH})),mode:process.argv.includes('--broadcast')?'broadcast':'preflight'}));
 if(!process.argv.includes('--broadcast'))return;
 const hashes=[];
 for(const step of steps){
  if(step.name==='setMintOpen'&&step.gas==='deferred'){const live=await estimate(provider,wallet.address,step.tx,fees);step.gas=live.gas;step.gasLimit=live.gasLimit;}
  const sent=await wallet.sendTransaction({...step.tx,gasLimit:step.gasLimit,maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas??0n});
  hashes.push({name:step.name,hash:sent.hash});console.log('Submitted '+step.name+' '+sent.hash);
  const receipt=await sent.wait(2);if(receipt.status!==1)fail(step.name+' reverted');
 }
 const [nextOpen,nextBase]=await Promise.all([c.mintOpen(),c.baseTokenURI()]);
 if(nextBase!==uri||nextOpen!==true)fail('On-chain configuration mismatch after owner calls.');
 const result={...record,baseTokenURI:nextBase,mintOpen:nextOpen,configureTransactions:hashes};
 fs.writeFileSync(file,JSON.stringify(result,null,2));
 if(fs.existsSync(site)){const published=JSON.parse(fs.readFileSync(site,'utf8'));published.baseTokenURI=nextBase;published.mintOpen=nextOpen;fs.writeFileSync(site,JSON.stringify(published,null,2));}
 console.log(JSON.stringify(result,null,2));
}
main().catch(err=>{console.error(err instanceof Error&&!('code' in err)?err.message:'Owner configuration did not complete. Sensitive RPC and signer error details suppressed; inspect public deployment record if one was updated.');process.exitCode=1;});
