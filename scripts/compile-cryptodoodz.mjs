import fs from 'node:fs';
import solc from 'solc';
export function compileDoodz(){
 const input={language:'Solidity',sources:{'CryptoDoodz.sol':{content:fs.readFileSync('contracts/CryptoDoodz.sol','utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
 const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>({contents:fs.readFileSync(`node_modules/${p}`,'utf8')})}));
 const errors=(output.errors??[]).filter(x=>x.severity==='error');if(errors.length)throw Error(errors.map(x=>x.formattedMessage).join('\n'));
 const c=output.contracts['CryptoDoodz.sol'].CryptoDoodz;
 const artifact={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object,compiler:solc.version()};
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/CryptoDoodz.json',JSON.stringify(artifact,null,2));
 // Include imported source text for reproducible explorer verification.
 for(const name of Object.keys(output.sources))if(!input.sources[name])input.sources[name]={content:fs.readFileSync(`node_modules/${name}`,'utf8')};
 fs.writeFileSync('artifacts/CryptoDoodz-standard-input.json',JSON.stringify(input,null,2));return artifact;
}
if(process.argv[1]?.endsWith('compile-cryptodoodz.mjs')){compileDoodz();console.log('CryptoDoodz compiled');}
