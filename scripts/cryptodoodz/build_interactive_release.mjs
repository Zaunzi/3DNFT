import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {build} from 'esbuild';
const checkout=path.resolve(process.argv[2]);const source=path.resolve(process.argv[3]);
const base='https://3dnft.vercel.app/cryptodoodz/';
const result=await build({entryPoints:[fileURLToPath(new URL('./interactive-viewer.js',import.meta.url))],bundle:true,format:'iife',minify:true,target:'es2020',write:false,legalComments:'eof'});
const bytes=result.outputFiles[0].contents;const digest=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
const root=path.join(checkout,'static/cryptodoodz'),out=path.join(root,'interactive');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,`viewer-${digest}.js`),bytes);
const recipes=JSON.parse(fs.readFileSync(path.join(source,'recipes.json'),'utf8'));const clips=['Idle','Walk','Run','Jump','Shoot','Wave'];
for(const r of recipes){
 const id=String(r.token_id).padStart(4,'0'),mp=path.join(root,'metadata',id+'.json'),meta=JSON.parse(fs.readFileSync(mp,'utf8'));
 const model=meta.animation_url.includes('/models/')?meta.animation_url:meta.properties?.model_url;
 if(!model?.startsWith(base+'models/'))throw Error('Missing original GLB for '+id);
 const background=r.sources.background;const config={name:r.name,model,background};
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${r.name}</title><style>
 *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background};font:14px system-ui;color:#17252d}body{display:flex;flex-direction:column}#stage{position:relative;flex:1;min-height:0;touch-action:none}canvas{display:block;width:100%;height:100%}#poster{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}#poster[hidden]{display:none}footer{flex:none;padding:8px 12px 12px;background:${background}}.bar{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;max-width:580px;margin:auto}button{font:600 13px system-ui;padding:11px 2px;border:1px solid #17252d30;border-radius:9px;color:#17252d;background:#ffffffb8;cursor:pointer}button[aria-pressed=true]{color:#fff;background:#17252d;border-color:#17252d}button:disabled{opacity:.4;cursor:wait}button:focus-visible{outline:3px solid #fff;outline-offset:2px}.caption{display:flex;justify-content:center;gap:8px;font-size:11px;margin:8px 0 0;color:#17252dc0}#status{font-weight:600}@media(max-width:330px){.bar{grid-template-columns:repeat(3,1fr)}button{padding:8px 2px}footer{padding:6px 8px 8px}}@media(max-height:300px){.caption{display:none}button{padding:6px 2px}footer{padding:4px 8px}}</style></head><body><main id="stage"><img id="poster" src="${meta.image}" alt="${r.name}"></main><footer><div class="bar" role="group" aria-label="Choose animation">${clips.map(c=>`<button type="button" data-clip="${c}" aria-pressed="false" disabled>${c}</button>`).join('')}</div><p class="caption"><span id="status" role="status" aria-live="polite">Loading 3D…</span><span aria-hidden="true">·</span><span>Drag to rotate</span></p></footer><script id="dood-config" type="application/json">${JSON.stringify(config).replaceAll('<','\\u003c')}</script><script src="${base}interactive/viewer-${digest}.js" defer></script></body></html>`;
 fs.writeFileSync(path.join(out,id+'.html'),html);
 meta.animation_url=base+'interactive/'+id+'.html?v='+digest;meta.background_color=background.slice(1);meta.properties={...meta.properties,model_url:model};
 fs.writeFileSync(mp,JSON.stringify(meta));
}
const vp=path.join(checkout,'vercel.json');const vc=fs.existsSync(vp)?JSON.parse(fs.readFileSync(vp,'utf8')):{};vc.headers??=[];
for(const route of ['/cryptodoodz/models/(.*)','/cryptodoodz/interactive/(.*)'])if(!vc.headers.some(h=>h.source===route))vc.headers.push({source:route,headers:[{key:'Access-Control-Allow-Origin',value:'*'}]});
fs.writeFileSync(vp,JSON.stringify(vc,null,2));
fs.writeFileSync(path.join(out,'release.json'),JSON.stringify({version:digest,models:1000,clips,background:'Per-token Background trait',source:'r10'},null,2));
console.log(JSON.stringify({viewerBundle:digest,bytes:bytes.length,htmlPages:recipes.length,metadataUpdated:recipes.length}));
