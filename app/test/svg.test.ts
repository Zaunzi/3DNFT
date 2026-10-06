import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeSVGDataURL} from '../src/nfts/svg.ts';
import {loadMetadata,parseMetadata} from '../src/nfts/metadata.ts';
test('Lil Ghosts onchain JSON preserves its bounded SVG image and traits',async()=>{
 const raw=readFileSync(new URL('./fixtures/lil-ghosts-1.json',import.meta.url),'utf8');
 const metadata=await loadMetadata('data:application/json;base64,'+Buffer.from(raw).toString('base64'),'https://ipfs.io/ipfs/');
 assert.equal(metadata.name,'Lil Ghosts #1');assert.equal(metadata.attributes.length,8);assert.match(decodeSVGDataURL(metadata.image!),/^<svg/);
});
test('SVG data decoding handles supported forms and rejects oversized or recursive media',()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
 for(const prefix of ['data:image/svg+xml,','data:image/svg+xml;utf8,','data:image/svg+xml;charset=utf-8,'])assert.equal(decodeSVGDataURL(prefix+encodeURIComponent(svg)),svg);
 for(const bad of ['data:text/html,<script/>','data:image/png;base64,AAAA','data:image/svg+xml;utf8,%ZZ','data:image/svg+xml;base64,!!!!','data:image/svg+xml,'+'a'.repeat(140000)])assert.throws(()=>decodeSVGDataURL(bad));
 assert.equal(parseMetadata('{"image":"data:text/html,hi"}','https://ipfs.io/ipfs/').image,undefined);
});
import {embeddedPNGLayers} from '../src/nfts/svg.ts';
test('onchain Milady embedded PNG layers decode without enabling arbitrary CSS',()=>{
 const svg=readFileSync(new URL('./fixtures/bootleg-milady-1.svg',import.meta.url),'utf8');
 const style=/style="([^"]+)"/.exec(svg)![1];
 assert.equal(embeddedPNGLayers(style).length,13);
 for(const bad of [style+'position:fixed;',style.replace('data:image/png;base64,','https://example.com/'),style.replace('background-size:contain','background-size:cover'),style.replace('iVBOR','AAAAA')])assert.throws(()=>embeddedPNGLayers(bad));
});
