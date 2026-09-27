import {build} from 'vite';
import fs from 'node:fs';
import {items} from './item-catalog.mjs';
export async function buildItem(id){
 const item=items.find(i=>i.id===id);if(!item)throw Error('Unknown item');
 const result=await build({configFile:false,logLevel:'warn',build:{write:false,minify:true,lib:{entry:`${item.source}/main.js`,name:item.global,formats:['iife']}}});
 const js=(Array.isArray(result)?result[0]:result).output.find(x=>x.type==='chunk').code;
 const nav='<nav class="item-nav" aria-label="CryptoDoodz items">'+items.map(i=>`<a href="/items/${i.id}/"${i.id===id?' aria-current="page"':''}>${String(i.id).padStart(3,'0')} / ${i.title}</a>`).join('')+'</nav>';
 let html=fs.readFileSync(`${item.source}/template.html`,'utf8');
 html=html.includes('<!--NAV-->')?html.replace('<!--NAV-->',nav):html.replace('</main>',nav+'</main>');
 if(id!==3)html=html.replace('</style>',`.item-nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.item-nav a{display:inline-block;border:1px solid #384252;color:#c8d1de;text-decoration:none;padding:9px 13px;border-radius:7px;font-size:13px}.item-nav a[aria-current=page]{border-color:#bbad89;color:#ffe0a8}.item-nav a:focus-visible{outline:3px solid #ffe0a8}</style>`);
 html=html.replaceAll('href="/dj-board/"','href="/items/1/"').replace('<!--SCRIPT-->',()=>'<script>'+js.replaceAll('</script','<\\/script')+'</script>');
 for(const dir of [`static/items/${id}`,`static/${item.source}`]){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(`${dir}/index.html`,html);}
 console.log(`Built /items/${id}/ (${html.length} bytes); /${item.source}/ alias retained`);
}
