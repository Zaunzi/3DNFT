// Static metadata ships with the Doodverse Vite build.
import fs from 'node:fs';
import { items } from './item-catalog.mjs';
const root=new URL('../app/public/trinkets/',import.meta.url);
fs.mkdirSync(new URL('metadata/',root),{recursive:true});fs.mkdirSync(new URL('images/',root),{recursive:true});fs.mkdirSync(new URL('play/',root),{recursive:true});fs.mkdirSync(new URL('models/',root),{recursive:true});
const shapes=[
 '<rect x="80" y="145" width="352" height="150" rx="20" fill="#343943"/><circle cx="172" cy="220" r="55"/><circle cx="340" cy="220" r="55"/><path d="M248 170v100M268 170v100" stroke="#d9b769" stroke-width="8"/>',
 '<rect x="55" y="150" width="402" height="155" rx="12" fill="#343943"/>'+Array.from({length:14},(_,i)=>`<rect x="${66+i*27}" y="188" width="24" height="100" fill="#f4e7ce"/>`).join(''),
 '<circle cx="256" cy="260" r="70"/>'+'<circle cx="170" cy="174" r="46"/><circle cx="340" cy="174" r="46"/><path d="M96 135h95M340 105h100M140 135v170M390 105v200" stroke="#d9b769" stroke-width="10"/>',
 Array.from({length:8},(_,i)=>`<rect x="${72+i*47}" y="${130+i*8}" width="38" height="${175-i*15}" rx="6" fill="${['#de7975','#e6a85d','#e1ca6d','#a0bd79','#6aacaa','#78a4c4','#a297c4','#c18ea7'][i]}"/>`).join(''),
 '<path d="M110 180l25 130h100l20-130M270 180l20 110h90l25-110" fill="#b87950"/><ellipse cx="182" cy="180" rx="73" ry="30" fill="#ecd2a0"/><ellipse cx="337" cy="180" rx="68" ry="28" fill="#ecd2a0"/>'
];
for(const item of items){
 const page=fs.readFileSync(new URL(`../static/${item.source}/index.html`,import.meta.url),'utf8').replace(/<nav class="item-nav"[\s\S]*?<\/nav>/g,'');
 fs.writeFileSync(new URL(`play/${item.id}.html`,root),page);
 fs.copyFileSync(new URL(`../app/src/trinkets/models/${item.id}.glb`,import.meta.url),new URL(`models/${item.id}.glb`,root));
 const image=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#142a28"/><g fill="#82978d">${shapes[item.id-1]}</g><text x="256" y="390" text-anchor="middle" fill="#eef3dc" font-family="sans-serif" font-size="32">${item.title}</text><text x="256" y="445" text-anchor="middle" fill="#b8cbba" font-family="sans-serif" font-size="20">DOODVERSE TRINKETS / ${item.id}</text></svg>`;
 fs.writeFileSync(new URL(`images/${item.id}.svg`,root),image+'\n');
 fs.writeFileSync(new URL(`metadata/${item.id}.json`,root),JSON.stringify({name:item.title,description:`${item.title}, a collectible instrument from Doodverse Trinkets. Open the interactive edition to play.`,image:`https://atlas-mu-lime.vercel.app/trinkets/images/${item.id}.svg`,animation_url:`https://atlas-mu-lime.vercel.app/trinkets/play/${item.id}.html`,external_url:`https://atlas-mu-lime.vercel.app/mint.html`,properties:{model_url:`https://atlas-mu-lime.vercel.app/trinkets/models/${item.id}.glb`},attributes:[{trait_type:'Collection',value:'Doodverse Trinkets'},{trait_type:'Instrument ID',value:item.id}]},null,2)+'\n');
}
