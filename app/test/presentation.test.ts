import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationMode } from '../src/viewer/mode.ts';
test('marketplace frames showcase parcels; explicit world links enter the full runtime',()=>{
  assert.equal(presentationMode('?tokenId=742',true),'showcase');
  assert.equal(presentationMode('?tokenId=742',false),'world');
  assert.equal(presentationMode('?mode=showcase',false),'showcase');
  assert.equal(presentationMode('?embed=1',false),'showcase');
  assert.equal(presentationMode('?mode=world&embed=1',true),'world');
});

test('homepage stays lightweight while direct world and NFT links preserve their destinations',()=>{
  assert.equal(presentationMode('',false),'landing');
  assert.equal(presentationMode('?utm_source=community',false),'landing');
  assert.equal(presentationMode('?mode=world',false),'world');
  assert.equal(presentationMode('?tokenId=0',false),'world');
  assert.equal(presentationMode('?tokenId=invalid',false),'world');
  assert.equal(presentationMode('?chain=8453&contract=0x123',false),'world');
  assert.equal(presentationMode('',true),'showcase');
});
