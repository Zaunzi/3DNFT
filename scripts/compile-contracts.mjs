import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile() {
 const sources=Object.fromEntries(['Cloudacre.sol','Seed.sol'].map(name=>[name,{content:fs.readFileSync(`contracts/${name}`,'utf8')}]));
 const result=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{viaIR:true,optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:(name)=>{try{return {contents:fs.readFileSync(path.join('node_modules',name),'utf8')}}catch{return {error:`Import not found: ${name}`}}}}));
 const errors=(result.errors??[]).filter(e=>e.severity==='error');if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
 fs.mkdirSync('artifacts',{recursive:true});fs.mkdirSync('src/lib/web3',{recursive:true});
 for(const name of ['Cloudacre','Seed']){const c=result.contracts[`${name}.sol`][name];const artifact={abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`};fs.writeFileSync(`artifacts/${name}.json`,JSON.stringify(artifact,null,2));fs.writeFileSync(`src/lib/web3/${name}.json`,JSON.stringify(c.abi,null,2))}
 return result.contracts;
}
if(process.argv[1]?.endsWith('compile-contracts.mjs')){compile();console.log('Compiled Cloudacre and Seed; generated frontend ABIs.')}

