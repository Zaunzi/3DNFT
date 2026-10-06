import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createBasePaintRelay} from './basepaint.mjs';
const origin='https://atlas-mu-lime.vercel.app';
async function setup(t,options){const relay=createBasePaintRelay({origins:[origin],...options});const server=createServer(async(req,res)=>{if(!await relay(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return `http://127.0.0.1:${server.address().port}`;}
const path='/media/basepaint/14/metadata';
test('metadata is fetched by token ID with CORS, cached and refreshed after TTL',async t=>{
 let now=0,calls=0;const url=await setup(t,{clock:()=>now,fetchResource:async(u,options)=>{calls++;assert.equal(u,'https://basepaint.xyz/api/art/'+'e'.padStart(64,'0'));assert.equal(options.redirect,'error');return Response.json({name:'BasePaint Day #14',image:'https://basepaint.xyz/api/art/image?day=14'});}});
 const r=await fetch(url+path,{headers:{Origin:origin}});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'*');assert.equal((await r.json()).name,'BasePaint Day #14');
 await (await fetch(url+path)).text();assert.equal(calls,1);now=300001;await (await fetch(url+path)).text();assert.equal(calls,2);
});
test('relay rejects arbitrary URLs, oversized IDs and write methods without fetching',async t=>{
 let calls=0;const url=await setup(t,{fetchResource:async()=>{calls++;return Response.json({});}});
 for(const suffix of ['/media/basepaint/14/metadata?url=https://evil.example','/media/basepaint/14/other','/media/basepaint/0/image','/media/basepaint/'+(1n<<256n)+'/image'])assert.equal((await fetch(url+suffix)).status,400);
 assert.equal((await fetch(url+path,{method:'POST'})).status,405);assert.equal(calls,0);
});
test('oversized, redirected, HTML and invalid JSON responses fail closed',async t=>{
 const responses=[new Response('x',{status:302,headers:{location:'https://evil.example'}}),new Response('<script/>',{headers:{'content-type':'text/html'}}),new Response('not JSON',{headers:{'content-type':'application/json'}}),new Response('x'.repeat(128*1024+1),{headers:{'content-type':'application/json'}})];
 const url=await setup(t,{fetchResource:async()=>responses.shift()});
 for(let i=0;i<4;i++)assert.equal((await fetch(url+path)).status,502);
});
test('image route returns only validated PNG bytes',async t=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
 const url=await setup(t,{fetchResource:async u=>{assert.equal(u,'https://basepaint.xyz/api/art/image?day=14');return new Response(png,{headers:{'content-type':'image/png'}});}});
 const r=await fetch(url+'/media/basepaint/14/image',{headers:{Origin:origin}});assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
});


test('public artwork loads in opaque marketplace frames without credential access',async t=>{
 const url=await setup(t,{fetchResource:async()=>Response.json({name:'BasePaint Day #14'})});
 for(const viewer of ['null','https://opensea.io','https://www.doodverse.xyz']){
  const r=await fetch(url+path,{headers:{Origin:viewer}});
  assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'*');
  assert.equal(r.headers.get('access-control-allow-credentials'),null);
 }
});
