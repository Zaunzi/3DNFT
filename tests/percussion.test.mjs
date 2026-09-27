import test from 'node:test';
import assert from 'node:assert/strict';
import {xyloNotes,bongoPads} from '../instruments/notes.js';
test('xylophone has 25 consecutive chromatic notes C4 through C6',()=>{assert.equal(xyloNotes.length,25);assert.equal(xyloNotes[0].name,'C4');assert.equal(xyloNotes.at(-1).name,'C6');assert.equal(xyloNotes.filter(n=>n.black).length,10);xyloNotes.forEach((n,i)=>assert.equal(n.note,60+i))});
test('each bongo has three distinct stroke targets',()=>{assert.equal(new Set(bongoPads.map(p=>p.id)).size,6);for(const drum of ['small','large'])assert.deepEqual(bongoPads.filter(p=>p.drum===drum).map(p=>p.stroke),['open','slap','rim'])});
