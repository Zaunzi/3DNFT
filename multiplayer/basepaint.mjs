// Narrow, bounded public-media relay. Never accepts a hostname or arbitrary URL.
export function createBasePaintRelay({origins,fetchResource=fetch,clock=Date.now}={}) {
 const cache=new Map(),pending=new Map();let bytesCached=0,windowStart=clock(),misses=0;
 const budget=16*1024*1024,ttl=300000;
 const remove=key=>{const entry=cache.get(key);if(entry)bytesCached-=entry.bytes.length;cache.delete(key);};
 async function load(id,kind){
  const upstream=kind==='metadata'?`https://basepaint.xyz/api/art/${BigInt(id).toString(16).padStart(64,'0')}`:`https://basepaint.xyz/api/art/image?day=${id}`;
  const limit=kind==='metadata'?128*1024:4*1024*1024;
  const response=await fetchResource(upstream,{signal:AbortSignal.timeout(6500),redirect:'error',credentials:'omit'});
  const type=response.headers.get('content-type')?.split(';')[0].toLowerCase();
  if(!response.ok||type!==(kind==='metadata'?'application/json':'image/png')||Number(response.headers.get('content-length')??0)>limit||!response.body)throw Error('Invalid media');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Too large');chunks.push(value);}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks,size);
  if(kind==='metadata'){const data=JSON.parse(bytes.toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid JSON');}
  else if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG');
  return {bytes,type,expires:clock()+ttl};
 }
 return async(req,res)=>{
  if(!req.url?.startsWith('/media/basepaint/'))return false;
  res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff');
  // These are public, credential-free artwork bytes. Marketplace sandboxes can
  // send Origin: null; do not apply the multiplayer login origin allowlist here.
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return true;}
  const match=/^\/media\/basepaint\/([1-9][0-9]{0,77})\/(metadata|image)$/.exec(req.url);
  if(!match||BigInt(match[1])>=1n<<256n){res.writeHead(400);res.end();return true;}
  const key=req.url;let value=cache.get(key);if(value&&value.expires<=clock()){remove(key);value=undefined;}
  try{
   if(!value){
    if(!pending.has(key)){
     if(clock()-windowStart>=60000){windowStart=clock();misses=0;}
     if(pending.size>=4||misses>=120){res.writeHead(503,{'Retry-After':'30'});res.end();return true;}
     misses++;
     const promise=load(match[1],match[2]).then(entry=>{while(cache.size>=128||bytesCached+entry.bytes.length>budget)remove(cache.keys().next().value);cache.set(key,entry);bytesCached+=entry.bytes.length;return entry;}).finally(()=>pending.delete(key));
     pending.set(key,promise);
    }
    value=await pending.get(key);
   }
   res.writeHead(200,{'Content-Type':value.type,'Content-Length':value.bytes.length,'Cache-Control':'public, max-age=300'});res.end(value.bytes);
  }catch{res.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'BasePaint media temporarily unavailable'}));}
  return true;
 };
}
