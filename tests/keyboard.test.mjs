import test from 'node:test';
import assert from 'node:assert/strict';
import {makeKeys,frequency} from '../keyboard/notes.js';
test('88-key layout spans A0 to C8 with correct piano geometry and tuning',()=>{const keys=makeKeys();assert.equal(keys.length,88);assert.equal(new Set(keys.map(k=>k.note)).size,88);assert.equal(keys[0].name,'A0');assert.equal(keys.at(-1).name,'C8');assert.equal(keys.filter(k=>!k.black).length,52);assert.equal(keys.filter(k=>k.black).length,36);assert.equal(frequency(69),440);assert.ok(Math.abs(frequency(21)-27.5)<.001);assert.ok(Math.abs(frequency(108)-4186.009)<.001);for(const k of keys.filter(k=>k.black)){const i=keys.indexOf(k);assert.equal(k.x,(keys[i-1].x+keys[i+1].x)/2)}});
