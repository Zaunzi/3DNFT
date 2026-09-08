import test from 'node:test';import assert from 'node:assert/strict';
import ganache from 'ganache';import {BrowserProvider,ContractFactory} from 'ethers';
import {compileDoodz} from '../scripts/compile-cryptodoodz.mjs';
test('free mint, lifetime cap, metadata access, transfer resistance and full sellout',async()=>{
 const chain=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:202,defaultBalance:10},chain:{hardfork:'shanghai'}});
 try{
 const provider=new BrowserProvider(chain);provider.pollingInterval=10;
 const owner=await provider.getSigner(0);const other=await provider.getSigner(1);const a=compileDoodz();
 const c=await new ContractFactory(a.abi,a.bytecode,owner).deploy(await owner.getAddress());await c.waitForDeployment();
 assert.equal(await c.MAX_SUPPLY(),1000n);assert.equal(await c.MAX_PER_WALLET(),5n);
 await assert.rejects(c.mint.staticCall(1));await assert.rejects(c.setMintOpen.staticCall(true));
 await assert.rejects(c.connect(other).setBaseURI.staticCall('https://bad/'));
 await(await c.setBaseURI('https://3dnft.vercel.app/cryptodoodz/metadata/')).wait();await(await c.setMintOpen(true)).wait();
 await assert.rejects(c.mint.staticCall(0));await assert.rejects(c.mint.staticCall(6));await assert.rejects(c.mint.staticCall(1,{value:1}));
 await(await c.mint(2)).wait();await(await c.mint(3)).wait();await assert.rejects(c.mint.staticCall(1));
 await(await c.transferFrom(await owner.getAddress(),await other.getAddress(),1)).wait();await assert.rejects(c.mint.staticCall(1));
 assert.equal(await c.mintedBy(await owner.getAddress()),5n);assert.equal(await c.tokenURI(1),'https://3dnft.vercel.app/cryptodoodz/metadata/0001.json');
 await(await c.setMintOpen(false)).wait();await assert.rejects(c.connect(other).mint.staticCall(1));await(await c.setMintOpen(true)).wait();
 const accounts=await chain.request({method:'eth_accounts',params:[]});
 for(let i=1;i<200;i++){const hash=await chain.request({method:'eth_sendTransaction',params:[{from:accounts[i],to:await c.getAddress(),data:c.interface.encodeFunctionData('mint',[5]),gas:'0x100000'}]});const receipt=await chain.request({method:'eth_getTransactionReceipt',params:[hash]});assert.equal(receipt.status,'0x1');}
 assert.equal(await c.totalSupply(),1000n);assert.equal(await c.tokenURI(1000),'https://3dnft.vercel.app/cryptodoodz/metadata/1000.json');
 await assert.rejects(c.connect(await provider.getSigner(200)).mint.staticCall(1));
 await(await c.freezeMetadata()).wait();await assert.rejects(c.setBaseURI.staticCall('https://other/'));
 await(await c.transferOwnership(await other.getAddress())).wait();assert.equal(await c.owner(),await owner.getAddress());await(await c.connect(other).acceptOwnership()).wait();assert.equal(await c.owner(),await other.getAddress());
 }finally{await chain.disconnect();}
});
