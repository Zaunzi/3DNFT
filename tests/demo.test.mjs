import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accrue,harvest,upgrade} from '../src/lib/farm.ts';
test('demo caps offline production and rejects clock rollback',()=>{const f={balance:0,stored:0,updated:1000,level:0};assert.equal(accrue(f,61000).stored,6);assert.equal(accrue(f,9999999).stored,20);assert.equal(accrue(f,0).stored,0)});
test('demo harvest retains fractional crops and upgrades settle the old rate',()=>{const f={balance:0,stored:6.7,updated:1000,level:0};assert.equal(harvest(f,1000).balance,6);assert.ok(Math.abs(harvest(f,1000).stored-.7)<1e-10);assert.equal(upgrade({...f,balance:19},1000).level,0);const next=upgrade({...f,balance:20,stored:0},61000);assert.equal(next.balance,0);assert.equal(next.level,1);assert.equal(next.stored,6);assert.equal(accrue(next,121000).stored,18)});
