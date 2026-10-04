import test from 'node:test';
import assert from 'node:assert/strict';
import {basePaintRelayURL} from '../src/nfts/basepaint.ts';
const relay='wss://3dnft-production.up.railway.app/';
test('BasePaint metadata and images use the same token-specific HTTPS relay',()=>{
 assert.equal(basePaintRelayURL('https://basepaint.xyz/api/art/'+'e'.padStart(64,'0'),relay),'https://3dnft-production.up.railway.app/media/basepaint/14/metadata');
 assert.equal(basePaintRelayURL('https://basepaint.xyz/api/art/image?day=14',relay),'https://3dnft-production.up.railway.app/media/basepaint/14/image');
});
test('other collections, arbitrary paths and nonsecure relay hosts are never rewritten',()=>{
 for(const url of ['https://evil.example/api/art/image?day=14','https://basepaint.xyz/api/art/image?day=14&url=x','https://basepaint.xyz/api/art/image?day=0','https://basepaint.xyz/other'])assert.equal(basePaintRelayURL(url,relay),undefined);
 assert.equal(basePaintRelayURL('https://basepaint.xyz/api/art/image?day=14','ws://evil.example'),undefined);
 assert.equal(basePaintRelayURL('https://basepaint.xyz/api/art/image?day=14'),undefined);
});
