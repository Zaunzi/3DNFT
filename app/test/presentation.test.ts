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
