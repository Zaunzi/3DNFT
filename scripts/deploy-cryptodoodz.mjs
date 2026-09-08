import fs from 'node:fs';
import {JsonRpcProvider,Wallet,ContractFactory,Contract,formatEther,keccak256} from 'ethers';
const expected='0xdb6882db2a406bc1541988715842906dfd4fd590';
const file='deployments/cryptodoodz-base-mainnet.json';
async function main(){
 let wallet;try{wallet=new Wallet(process.env.DEPLOY_PRIVATE_KEY);}catch{throw Error('DEPLOY_PRIVATE_KEY is missing or invalid; key was not displayed.');}
 if(wallet.address.toLowerCase()!==expected)throw Error('Deployment key does not match the authorized wallet.');
 const provider=new JsonRpcProvider('https://mainnet.base.org',8453,{staticNetwork:true});
 if(BigInt(await provider.send('eth_chainId',[]))!==8453n)throw Error('Wrong chain');
 wallet=wallet.connect(provider);
 const a=JSON.parse(fs.readFileSync('artifacts/CryptoDoodz.json'));
 if(fs.existsSync(file)){console.log('Existing deployment record; refusing a duplicate.');console.log(fs.readFileSync(file,'utf8'));return;}
 const factory=new ContractFactory(a.abi,a.bytecode,wallet);const tx=await factory.getDeployTransaction(wallet.address);
 const [balance,gas,fees]=await Promise.all([provider.getBalance(wallet.address),provider.estimateGas({...tx,from:wallet.address}),provider.getFeeData()]);
 const gasLimit=gas*125n/100n;const maxFeePerGas=fees.maxFeePerGas;
 if(!maxFeePerGas)throw Error('No gas price available');
 const maximumL2=gasLimit*maxFeePerGas;
 if(maximumL2>1000000000000000n)throw Error('Estimated L2 deployment exceeds conservative 0.001 ETH ceiling.');
 if(balance<maximumL2+100000000000000n)throw Error('Insufficient Base ETH for deployment plus L1 fee buffer.');
 console.log(JSON.stringify({wallet:wallet.address,chainId:8453,balanceETH:formatEther(balance),estimatedGas:gas.toString(),maxL2GasETH:formatEther(maximumL2),mintOpen:false,mode:process.argv.includes('--broadcast')?'broadcast':'preflight'}));
 if(!process.argv.includes('--broadcast'))return;
 const c=await factory.deploy(wallet.address,{gasLimit,maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas??0n});
 const hash=c.deploymentTransaction().hash;
 fs.mkdirSync('deployments',{recursive:true});
 fs.writeFileSync(file,JSON.stringify({chainId:8453,owner:wallet.address,address:await c.getAddress(),transaction:hash,status:'submitted'},null,2));
 console.log('Submitted '+hash);
 const receipt=await c.deploymentTransaction().wait(2);if(receipt.status!==1)throw Error('Deployment reverted');
 const address=await c.getAddress();const code=await provider.getCode(address);
 if(code!==a.deployedBytecode)throw Error('Runtime bytecode mismatch');
 const view=new Contract(address,a.abi,provider);
 const owner=await view.owner();const supply=await view.MAX_SUPPLY();const limit=await view.MAX_PER_WALLET();const minted=await view.totalSupply();const open=await view.mintOpen();
 if(owner.toLowerCase()!==expected||supply!==1000n||limit!==5n||minted!==0n||open!==false)throw Error('On-chain configuration mismatch');
 const result={chainId:8453,address,owner,transaction:hash,blockNumber:receipt.blockNumber,status:'confirmed',maxSupply:Number(supply),maxPerWallet:Number(limit),totalSupply:Number(minted),mintOpen:open,mintPriceWei:'0',gasUsed:receipt.gasUsed.toString(),runtimeHash:keccak256(code)};
 fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(()=>{console.error('Deployment/preflight did not complete. Sensitive RPC and signer error details suppressed; inspect public deployment record if one was created.');process.exitCode=1;});
