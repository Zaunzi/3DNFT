import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile() {
 const names=['Cloudacre','Seed','OilField','Oil'];
 const sources=Object.fromEntries([...names.map(n=>`${n}.sol`),'test/TestEntropy.sol'].map(name=>[name,{content:fs.readFileSync(`contracts/${name}`,'utf8')}]));
 const result=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{viaIR:true,optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:name=>{try{return {contents:fs.readFileSync(path.join('node_modules',name),'utf8')}}catch{return {error:`Import not found: ${name}`}}}}));
 const errors=(result.errors??[]).filter(e=>e.severity==='error');if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
 fs.mkdirSync('artifacts',{recursive:true});fs.mkdirSync('src/lib/web3',{recursive:true});
 for(const name of [...names,'TestEntropy']){
  const c=result.contracts[name==='TestEntropy'?'test/TestEntropy.sol':`${name}.sol`][name];
  fs.writeFileSync(`artifacts/${name}.json`,JSON.stringify({abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`},null,2));
  if(name!=='TestEntropy')fs.writeFileSync(`src/lib/web3/${name}.json`,JSON.stringify(c.abi,null,2));
 }
 return result.contracts;
}
if(process.argv[1]?.endsWith('compile-contracts.mjs')){compile();console.log('Compiled legacy farm and seasonal OilField contracts; generated frontend ABIs.')}
