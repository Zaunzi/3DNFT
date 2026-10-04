// Explorer verification only: never signs or sends a blockchain transaction.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Interface} from 'ethers';
const key=process.env.ETHERSCAN_API_KEY;if(!key)throw new Error('ETHERSCAN_API_KEY is required');
const forge=process.env.FORGE_BIN||'forge';
const plan=JSON.parse(fs.readFileSync('docs/deployments/doodverse-art-mounts-base-mainnet.json','utf8'));
const journal=plan;
const reportPath='docs/deployments/doodverse-art-mounts-basescan-verification.json';
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{};
const safe=s=>String(s).split(key).join('[redacted]');
let failed=false;
for(const [name,address] of Object.entries(journal.addresses)) {
 if(report[name]?.verified&&report[name].address===address){console.log(`${name}: already verified`);continue;}
 await new Promise(resolve=>setTimeout(resolve,2000));
 const artifact=JSON.parse(fs.readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8'));
 const args=new Interface(artifact.abi).encodeDeploy(plan.constructorArgs[name]).slice(2);
 const result=spawnSync(forge,['verify-contract',address,`src/${name}.sol:${name}`,'--root','contracts','--chain','8453','--verifier','etherscan','--constructor-args',args,'--watch'],{encoding:'utf8',env:process.env,windowsHide:true,timeout:180000,maxBuffer:4*1024*1024});
 const output=safe((result.stdout??'')+'\n'+(result.stderr??''));
 console.log(`${name}: ${output.trim()}`);
 const verified=result.status===0&&/successfully verified|already verified|already been verified|Pass - Verified/i.test(output);
 report[name]={address,verified,checkedAt:new Date().toISOString(),url:`https://basescan.org/address/${address}#code`};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 if(!verified)failed=true;
}
if(failed)process.exitCode=1;
