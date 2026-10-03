import test from 'node:test';
import assert from 'node:assert/strict';
import {walletIdentityChanged} from '../src/player/walletIdentity.ts';
const wallet={connectedAddress:'0x1111111111111111111111111111111111111111' as const,chainId:8453,isConnected:true};
test('transaction wallet refreshes preserve selected avatar',()=>{assert.equal(walletIdentityChanged(wallet,{...wallet}),false);});
test('disconnect, account and network changes invalidate selected avatar',()=>{assert.equal(walletIdentityChanged(wallet,{connectedAddress:null,chainId:null,isConnected:false}),true);assert.equal(walletIdentityChanged(wallet,{...wallet,chainId:1}),true);assert.equal(walletIdentityChanged(wallet,{...wallet,connectedAddress:'0x2222222222222222222222222222222222222222'}),true);});
