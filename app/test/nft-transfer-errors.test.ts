import test from 'node:test';
import assert from 'node:assert/strict';
import {BaseError,ContractFunctionRevertedError,decodeErrorResult} from 'viem';
import {nftTransferErrors,explainNFTTransferError} from '../src/nfts/transferErrors.ts';

test('collection allowlist revert is decoded through the escrow error chain',()=>{
 const data='0xe1f1d02e';
 assert.equal(decodeErrorResult({abi:nftTransferErrors,data}).errorName,'CreatorTokenTransferValidator__CallerOrFromMustBeWhitelisted');
 const revert=new ContractFunctionRevertedError({abi:nftTransferErrors,data,functionName:'attach'});
 const error=new BaseError('Simulation failed',{cause:revert});
 const explained=explainNFTTransferError(error);
 assert.ok(explained instanceof Error);
 assert.match(explained.message,/collection blocks transfers/);
 assert.equal(explained.cause,error);
});
test('unrelated reverts and wallet errors retain their original diagnostics',()=>{
 const denied=new Error('User rejected request');assert.equal(explainNFTTransferError(denied),denied);
 const bounds=new ContractFunctionRevertedError({abi:nftTransferErrors,data:'0xf80f1445',functionName:'attach'});
 assert.equal(explainNFTTransferError(bounds),bounds);
});


test('key copy recipient rejection is decoded and explains the wallet requirement',()=>{
 const data=`0x57f447ce${'0'.repeat(24)}${'1'.repeat(40)}` as `0x${string}`;
 assert.equal(decodeErrorResult({abi:nftTransferErrors,data}).errorName,'ERC1155InvalidReceiver');
 const revert=new ContractFunctionRevertedError({abi:nftTransferErrors,data,functionName:'issueCopies'});
 const explained=explainNFTTransferError(new BaseError('Simulation failed',{cause:revert}));
 assert.ok(explained instanceof Error);assert.match(explained.message,/recipient address cannot receive/);assert.match(explained.message,/friend connects to Doodverse/);
});
