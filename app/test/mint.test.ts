import test from 'node:test';
import assert from 'node:assert/strict';
import { mintInput, parcelMintQuantity } from '../src/mint/model.ts';
const owner = '0x1111111111111111111111111111111111111111';
test('mint input preserves bigint IDs and bounds parcel IDs and item quantities', () => {
  assert.equal(mintInput('parcel', owner, '4999', '').id, 4999n);
  assert.equal(mintInput('character', owner, '9007199254740993', '').id, 9007199254740993n);
  assert.equal(mintInput('item', owner, '3', '12').quantity, 12n);
  for (const id of ['5000','-1','1.5','1e2']) assert.throws(() => mintInput('parcel', owner, id, ''));
  for (const quantity of ['0','-1','1.5','1000001']) assert.throws(() => mintInput('item', owner, '1', quantity));
  assert.throws(() => mintInput('item', owner, '7', '1'));
  assert.throws(() => mintInput('character', owner, String(2n ** 256n), ''));
  assert.throws(() => mintInput('parcel', '0x0000000000000000000000000000000000000000', '742', ''));
  assert.throws(() => mintInput('parcel', 'invalid', '742', ''));
});

test('trinket IDs are independent of the six parcel utility IDs', () => {
  assert.equal(mintInput('trinket', owner, '5', '2').quantity,2n);
  assert.throws(()=>mintInput('trinket',owner,'6','1'));
  assert.throws(()=>mintInput('trinket',owner,'1','0'));
  assert.equal(mintInput('item',owner,'6','1').id,6n);
});

test('automatic parcel mint accepts only a quantity of one through five',()=>{
  assert.equal(parcelMintQuantity('5'),5n);
  for(const input of ['0','6','-1','1.5','1e0',''])assert.throws(()=>parcelMintQuantity(input));
});
