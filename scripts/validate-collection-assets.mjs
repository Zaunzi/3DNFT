import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'app/public'),origin='https://atlas-mu-lime.vercel.app';
function linked(url){const u=new URL(url);assert.equal(u.origin,origin);const file=path.join(root,u.pathname);assert.ok(fs.existsSync(file),`Missing ${u.pathname}`);return file;}
for(const [collection,count,pad] of [['cryptodoodz',5000,4],['trinkets',5,1]]){
 for(const folder of ['metadata','images','models'])assert.equal(fs.readdirSync(path.join(root,collection,folder)).length,count,`${collection}/${folder} count`);
 for(let id=1;id<=count;id++){
  const name=String(id).padStart(pad,'0');const meta=JSON.parse(fs.readFileSync(path.join(root,collection,'metadata',name+'.json'),'utf8'));
  assert.ok(meta.name&&meta.attributes?.length);linked(meta.image);linked(meta.animation_url);const model=linked(meta.properties.model_url);
  const bytes=fs.readFileSync(model);assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  if(collection==='cryptodoodz'){const image=fs.readFileSync(linked(meta.image));assert.equal(image.readUInt32BE(16),512);assert.equal(image.readUInt32BE(20),512);}
 }
}
console.log('Hosted collection validation passed: 5000 characters, 5 trinkets, all metadata/model/image/animation links resolve on Doodverse.');
