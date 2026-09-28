import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeErrorResult } from 'viem';
import { portalsAbi } from '../src/items/onchainInventory.ts';
test('portal ABI decodes the nested land error for an unminted destination',()=>{
  const data=`0x7e273289${1934n.toString(16).padStart(64,'0')}` as const;
  const result=decodeErrorResult({abi:portalsAbi,data});
  assert.equal(result.errorName,'ERC721NonexistentToken');
  assert.deepEqual(result.args,[1934n]);
});
