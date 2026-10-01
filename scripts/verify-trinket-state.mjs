// Verify the additive custody contract without signing transactions.
import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {Interface} from 'ethers';
const key=process.env.ETHERSCAN_API_KEY;if(!key)throw Error('ETHERSCAN_API_KEY required');
const reportPath='docs/deployments/world-trinket-state-base.json',report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const a=JSON.parse(fs.readFileSync('contracts/out/WorldTrinketState.sol/WorldTrinketState.json','utf8'));
const args=new Interface(a.abi).encodeDeploy([report.land,report.items]).slice(2);
const result=spawnSync(process.env.FORGE_BIN||'forge',['verify-contract',report.address,'src/WorldTrinketState.sol:WorldTrinketState','--root','contracts','--chain','8453','--verifier','etherscan','--constructor-args',args,'--watch'],{encoding:'utf8',env:process.env,windowsHide:true,timeout:180000});
const output=((result.stdout??'')+'\n'+(result.stderr??'')).split(key).join('[redacted]');console.log(output);
report.verified=result.status===0&&/successfully verified|already verified|already been verified|Pass - Verified/i.test(output);
report.explorer=`https://basescan.org/address/${report.address}#code`;fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');if(!report.verified)process.exitCode=1;
