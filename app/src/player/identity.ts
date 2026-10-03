/** Random cosmetic guest per page visit; never grants NFT ownership or alters world generation. */
export const GUEST_DOOD_ID = BigInt(crypto.getRandomValues(new Uint32Array(1))[0] % 5000 + 1);
