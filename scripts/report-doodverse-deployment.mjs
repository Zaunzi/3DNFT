// Read-only receipt audit. Exports public deployment facts, never signer material.
import fs from 'node:fs';
import {JsonRpcProvider,formatEther,id} from 'ethers';
const journal=JSON.parse(fs.readFileSync('deployments/doodverse-base-mainnet.json','utf8'));
if(journal.status!=='confirmed')throw Error('Deployment is not complete');
const rpc=new JsonRpcProvider('https://mainnet.base.org',8453,{staticNetwork:true});
try{
  let total=0n;
  const transactions=[];
  for(const entry of journal.transactions){
    const receipt=await rpc.send('eth_getTransactionReceipt',[entry.hash]);
    if(!receipt||receipt.status!=='0x1')throw Error(`Missing successful receipt: ${entry.name}`);
    // None of these deployment/binding calls may emit a token transfer event.
    const transfers=new Set(['Transfer(address,address,uint256)','TransferSingle(address,address,address,uint256,uint256)','TransferBatch(address,address,address,uint256[],uint256[])'].map(id));
    if(receipt.logs.some(log=>transfers.has(log.topics[0]?.toLowerCase())))throw Error('Unexpected mint/transfer event');
    const gas=BigInt(receipt.gasUsed),l2=gas*BigInt(receipt.effectiveGasPrice),l1=BigInt(receipt.l1Fee??0);
    // Current Base operator scalar is recorded, not assumed. For nonzero parameters,
    // avoid guessing the active fork's fee formula from the receipt alone.
    if(BigInt(receipt.operatorFeeScalar??0)||BigInt(receipt.operatorFeeConstant??0))throw Error('Nonzero operator fee: calculate active fork fee before reporting total');
    const fee=l2+l1;total+=fee;
    transactions.push({name:entry.name,hash:entry.hash,blockNumber:Number(BigInt(receipt.blockNumber)),gasUsed:gas.toString(),feeETH:formatEther(fee)});
  }
  const report={chainId:8453,owner:journal.owner,runtime:journal.runtime,seed:journal.seed,minted:0,addresses:journal.addresses,totalFeeETH:formatEther(total),transactions};
  fs.mkdirSync('docs/deployments',{recursive:true});
  fs.writeFileSync('docs/deployments/doodverse-base-mainnet.json',JSON.stringify(report,null,2)+'\n');
  fs.copyFileSync('deployments/doodverse-base.env','docs/deployments/doodverse-base.env.example');
  console.log(JSON.stringify({confirmedTransactions:transactions.length,minted:0,totalFeeETH:report.totalFeeETH},null,2));
}finally{await rpc.destroy();}
