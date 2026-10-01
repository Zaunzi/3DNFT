import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldInputMode} from '../src/player/inputMode.ts';
function setup(){let locks=0,unlocks=0;const states:string[]=[];const input=new WorldInputMode({render:s=>states.push(s),lock:()=>{locks++;},unlock:()=>{unlocks++;}});return {input,states,counts:()=>({locks,unlocks})};}
test('closing menus resumes movement without returning to welcome',()=>{
 const {input,states,counts}=setup();input.resume();input.menu(true);input.unlocked();input.menu(false);input.locked();
 assert.equal(input.mode,'movement');assert.deepEqual(states,['movement','menu','menu','movement','movement']);assert.equal(counts().locks,2);
});
test('Tab toggles cursor and movement, while menu focus stays with menus',()=>{
 const {input}=setup();input.toggleCursor();assert.equal(input.mode,'welcome');input.resume();input.toggleCursor();assert.equal(input.mode,'cursor');input.unlocked();input.toggleCursor();assert.equal(input.mode,'movement');input.menu(true);input.toggleCursor();assert.equal(input.mode,'menu');
});
test('pointer lock denial retains movement fallback; stale lock cannot activate a menu',()=>{
 const {input,counts}=setup();input.resume();input.lockFailed();assert.equal(input.mode,'movement');input.menu(true);input.locked();input.lockFailed();assert.equal(input.mode,'menu');assert.equal(counts().unlocks,2);
});
test('Escape/unexpected unlock releases the cursor without reopening welcome',()=>{
 const {input}=setup();input.resume();input.unlocked();assert.equal(input.mode,'cursor');input.resume();input.release();input.unlocked();assert.equal(input.mode,'cursor');input.menu(true);input.release();assert.equal(input.mode,'menu');
});
