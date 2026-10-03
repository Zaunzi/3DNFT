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

import {parseTokenId} from '../src/world/coordinates.ts';
import {dragOrbit} from '../src/viewer/orbit.ts';
test('default world entry is parcel 1 without overriding explicit parcel IDs',()=>{
  assert.equal(parseTokenId(null),1);assert.equal(parseTokenId('0'),0);assert.equal(parseTokenId('742'),742);
});
test('showcase dragging changes both angles and cannot flip below terrain or over the pole',()=>{
  const moved=dragOrbit(.7,.68,100,50);assert.ok(moved.angle>.7);assert.ok(moved.elevation>.68);
  const reversed=dragOrbit(.7,.68,-100,-50);assert.ok(reversed.angle<.7);assert.ok(reversed.elevation<.68);
  assert.equal(dragOrbit(0,.68,0,-10000).elevation,.15);
  assert.equal(dragOrbit(0,.68,0,10000).elevation,1.35);
});

import {zoomOrbit} from '../src/viewer/orbit.ts';
test('parcel zoom moves both ways, reverses and stays bounded',()=>{
  const near=zoomOrbit(1,-120);assert.ok(near<1);assert.ok(zoomOrbit(1,120)>1);
  assert.ok(Math.abs(zoomOrbit(near,120)-1)<1e-12);
  assert.equal(zoomOrbit(.25,-500),.25);assert.equal(zoomOrbit(2,500),2);
  assert.equal(zoomOrbit(1,0),1);
});
