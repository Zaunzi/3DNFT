import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory} from 'ethers';
import {compileItems} from '../scripts/compile-items.mjs';
test('ERC1155 item editions, authority, transfers, caps and metadata freezing',async()=>{
const rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}});
try{
const provider=new BrowserProvider(rpc);const owner=await provider.getSigner(0),alice=await provider.getSigner(1),bob=await provider.getSigner(2);const a=compileItems();const c=await new ContractFactory(a.abi,a.bytecode,owner).deploy(await owner.getAddress());await c.waitForDeployment();
assert.equal(await c.supportsInterface('0xd9b67a26'),true);
await assert.rejects(c.connect(alice).createItem(1,10,'ipfs://metadata/1.json'));
await assert.rejects(c.createItem(0,10,'ipfs://metadata/0.json'));
await (await c.createItem(1,10,'ipfs://metadata/1.json')).wait();
await (await c.createItem(2,5,'ipfs://metadata/2.json')).wait();
await assert.rejects(c.createItem(1,100,'ipfs://replace'));
await assert.rejects(c.connect(alice).mint(await alice.getAddress(),1,1,'0x'));
await assert.rejects(c.mint(await alice.getAddress(),3,1,'0x'));
await assert.rejects(c.mint(await alice.getAddress(),1,0,'0x'));
await (await c.mint(await alice.getAddress(),1,7,'0x')).wait();
await (await c.mint(await alice.getAddress(),2,3,'0x')).wait();
assert.equal(await c['totalSupply(uint256)'](1),7n);
await assert.rejects(c.mint(await alice.getAddress(),1,4,'0x'));
await (await c.connect(alice).safeTransferFrom(await alice.getAddress(),await bob.getAddress(),1,2,'0x')).wait();
assert.equal(await c.balanceOf(await bob.getAddress(),1),2n);
await assert.rejects(c.connect(bob).safeTransferFrom(await alice.getAddress(),await bob.getAddress(),1,1,'0x'));
await (await c.connect(alice).safeBatchTransferFrom(await alice.getAddress(),await bob.getAddress(),[1,2],[1,2],'0x')).wait();
assert.deepEqual(Array.from(await c.balanceOfBatch([await bob.getAddress(),await bob.getAddress()],[1,2])),[3n,2n]);
await (await c.setItemURI(1,'ipfs://final/1.json')).wait();
assert.equal(await c.uri(1),'ipfs://final/1.json');
await (await c.freezeItemMetadata(1)).wait();
await assert.rejects(c.setItemURI(1,'ipfs://changed'));
await assert.rejects(c.uri(99));
await (await c.mint(await bob.getAddress(),1,3,'0x')).wait();
assert.equal(await c['totalSupply(uint256)'](1),10n);
await assert.rejects(c.mint(await bob.getAddress(),1,1,'0x'));
}finally{await rpc.disconnect()}
});
