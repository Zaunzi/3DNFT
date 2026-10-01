import fs from 'node:fs';
import solc from 'solc';
const sources = Object.fromEntries(fs.readdirSync('contracts/src').filter(n=>n.endsWith('.sol')).map(n=>[`contracts/src/${n}`,{content:fs.readFileSync(`contracts/src/${n}`,'utf8')}]));
for(const folder of ['contracts/script','contracts/world-test']) for(const n of fs.readdirSync(folder).filter(n=>n.endsWith('.sol'))) sources[`${folder}/${n}`]={content:fs.readFileSync(`${folder}/${n}`,'utf8')};
const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}}),{import:path=>{try{return {contents:fs.readFileSync(`node_modules/${path}`,'utf8')}}catch{return {error:`Missing import ${path}`}}}}));
for(const e of output.errors??[]) console.error(e.formattedMessage);
if(output.errors?.some(e=>e.severity==='error')) process.exit(1);
for(const [file,contracts] of Object.entries(output.contracts)) for(const [name,c] of Object.entries(contracts)) {
 if(!file.startsWith('contracts/src/')) continue;
 const size=c.evm.deployedBytecode.object.length/2;
 if(size>24576) throw new Error(`${name} exceeds EIP-170: ${size}`);
 const dir=`artifacts/atlas-v2/${name}.sol`;fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify({abi:c.abi,bytecode:{object:'0x'+c.evm.bytecode.object},deployedBytecode:{object:'0x'+c.evm.deployedBytecode.object}}));
 console.log(`${name}: ${size} runtime bytes`);
}
