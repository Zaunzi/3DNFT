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
