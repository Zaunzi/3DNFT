import test from 'node:test';
import assert from 'node:assert/strict';
import {items,resolveItem} from '../scripts/item-catalog.mjs';
import {drums} from '../drumkit/drums.js';
test('numbered item URLs and original links resolve to the same item',()=>{for(const item of items)for(const path of [`/items/${item.id}`,`/items/${item.id}/`,`/items/${item.id}/index.html`,`/${item.source}/`])assert.equal(resolveItem(path)?.id,item.id);for(const path of ['/items/6','/items/11','/items/1/anything','/items/../1','/keyboard/no'])assert.equal(resolveItem(path),undefined)});
test('drum pads have unique sound and keyboard mappings',()=>{assert.equal(drums.length,8);assert.equal(new Set(drums.map(d=>d.id)).size,8);assert.equal(new Set(drums.map(d=>d.key)).size,8)});
