// Run with node --experimental-strip-types scripts/generate-atlas-item-metadata.mjs.
import fs from 'node:fs';
import {ITEM_DEFINITIONS} from '../app/src/items/definitions.ts';
const directory=new URL('../app/public/metadata/items/',import.meta.url);
fs.mkdirSync(directory,{recursive:true});
const colors=['#8f9995','#987349','#76d4d0','#e5c768','#e7b069','#ab95da'];
for(const item of ITEM_DEFINITIONS){
  const id=item.id.toString(16).padStart(64,'0');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#193b32"/><path d="M256 92 380 164V308L256 380 132 308V164Z" fill="${colors[item.id-1]}"/><text x="256" y="264" text-anchor="middle" font-family="sans-serif" font-size="72" fill="#193b32">${item.id}</text><text x="256" y="442" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#eef3dc">ATLAS / ${item.name.toUpperCase()}</text></svg>`;
  fs.writeFileSync(new URL(`${id}.svg`,directory),svg+'\n');
  fs.writeFileSync(new URL(`${id}.json`,directory),JSON.stringify({name:item.name,description:item.description,image:`https://atlas-mu-lime.vercel.app/metadata/items/${id}.svg`,attributes:[{trait_type:'Item ID',value:item.id},{trait_type:'Registry version',value:1}]},null,2)+'\n');
}
