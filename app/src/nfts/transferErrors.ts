import {BaseError,ContractFunctionRevertedError,parseAbi} from 'viem';

export const nftTransferErrors=parseAbi([
 'error CreatorTokenTransferValidator__CallerOrFromMustBeWhitelisted()',
 'error CreatorTokenTransferValidator__CallerMustBeWhitelisted()',
 'error Unauthorized()', 'error InvalidLocation()', 'error Missing()', 'error Occupied()', 'error InvalidAsset()',
]);

/** Collection policy errors bubble through escrow. Approval cannot override that policy. */
export function explainNFTTransferError(error:unknown):unknown {
 const revert=error instanceof BaseError?error.walk(e=>e instanceof ContractFunctionRevertedError):undefined;
 if(revert instanceof ContractFunctionRevertedError&&[
  'CreatorTokenTransferValidator__CallerOrFromMustBeWhitelisted',
  'CreatorTokenTransferValidator__CallerMustBeWhitelisted',
 ].includes(revert.data?.errorName??''))return new Error(
  'This NFT collection blocks transfers through Doodverse escrow. Its transfer-policy administrator must allow Doodverse before it can be attached. Wallet approval alone cannot override this restriction.',{cause:error});
 return error;
}
