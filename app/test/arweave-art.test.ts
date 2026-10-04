import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveURL,parseMetadata,loadSafeImage} from '../src/nfts/metadata.ts';
const gateway='https://ipfs.io/ipfs/';
test('Arweave transaction URLs resolve directly to the isolated gateway',()=>{
 assert.equal(resolveURL('https://arweave.net/rjhu0KMfjsGFkjTxuBZBgRMTtZveHMxwNK1cVX5IqP0',gateway),'https://vy4g5ufdd6hmdbmsgty3qfsbqejrhnm33yomy4buvvofk7sivd6q.arweave.net/rjhu0KMfjsGFkjTxuBZBgRMTtZveHMxwNK1cVX5IqP0');
 assert.equal(resolveURL('https://example.com/art.png',gateway),'https://example.com/art.png');
});
test('supported collection thumbnails replace print originals, invalid URLs retain originals',()=>{
 const metadata={image:'https://example.com/original.jpg',attributes:[{trait_type:'Thumbnail Link',value:'https://example.com/small.jpg'},{trait_type:'Thumbnail MIME Type',value:'image/jpeg'}]};
 assert.equal(parseMetadata(JSON.stringify(metadata),gateway).image,'https://example.com/small.jpg');
 metadata.attributes[0].value='javascript:alert(1)';
 assert.equal(parseMetadata(JSON.stringify(metadata),gateway).image,metadata.image);
});
test('GIF dimensions are checked before requesting a bounded first-frame decode',async t=>{
 const bytes=new Uint8Array([71,73,70,56,57,97,32,0,32,0]);
 t.mock.method(globalThis,'fetch',async()=>new Response(bytes,{headers:{'content-type':'image/gif'}}));
 const previous=globalThis.createImageBitmap;
 let decoded=false;
 globalThis.createImageBitmap=(async(_blob:Blob,options:ImageBitmapOptions)=>{decoded=true;assert.equal(options.resizeWidth,512);return {width:512,height:512,close(){}} as ImageBitmap;}) as typeof createImageBitmap;
 try {await loadSafeImage('https://example.com/art.gif');assert.ok(decoded);decoded=false;bytes[6]=255;bytes[7]=255;await assert.rejects(loadSafeImage('https://example.com/art.gif'),/dimensions/);assert.equal(decoded,false);}
 finally{globalThis.createImageBitmap=previous;}
});
