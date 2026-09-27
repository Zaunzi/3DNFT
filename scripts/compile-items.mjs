import fs from 'node:fs';
import solc from 'solc';
export function compileItems(){
const input={language:'Solidity',sources:{'CryptoDoodzItems.sol':{content:fs.readFileSync('contracts/CryptoDoodzItems.sol','utf8').replace(/^\uFEFF/,'')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>({contents:fs.readFileSync(`node_modules/${p}`,'utf8')})}));
const errors=(output.errors??[]).filter(x=>x.severity==='error');if(errors.length)throw Error(errors.map(x=>x.formattedMessage).join('\n'));
const c=output.contracts['CryptoDoodzItems.sol'].CryptoDoodzItems;const artifact={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object};fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/CryptoDoodzItems.json',JSON.stringify(artifact,null,2));return artifact;
}
if(process.argv[1]?.endsWith('compile-items.mjs')){compileItems();console.log('CryptoDoodzItems compiled');}
