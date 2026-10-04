# Public collections and external editions — Base mainnet

The October 3, 2026 deployment adds to the existing parcel world. Land, buildings, doors, portals, ERC-721 escrow and utility-item contracts are unchanged.

| Contract | Address |
| --- | --- |
| External ERC-1155 custody (`WorldEditionState`) | `0xbAf278f2F6268a92745804a44154750d1eBe5D63` |
| Public Characters | `0x16E9432a0a09c903e70ca8467Ce3bfE77b3Dc56f` |
| Public Trinkets | `0x2146CbbbbeBD6585172155ba937cc725c9849fEC` |
| New Trinket custody | `0x20484b268342156218b95d08832c21DD0ceDA90c` |

Owner of both collections: `0xdB6882db2a406bc1541988715842906dfd4fd590`. Both escrow contracts bind to existing land `0x383891F3537627Fb9E235f0242D874fe00Ca6443`. No tokens were minted during deployment. Public receipts and constructor arguments are in `deployments/doodverse-public-base-mainnet.json` beside this document.

## Minting

Characters: free public mint, sequential IDs 1–5000, five lifetime mints per wallet. Transferring a token does not replenish the allowance. Metadata and models live on the current Doodverse Vercel build.

Trinkets: free public mint, one of each ID per wallet for life. Five initial IDs. The owner can append new IDs with `addTrinket()`; publish their metadata and runtime models when adding them. Mint pause and metadata base URI updates are owner-only in both collections. Pausing mint does not stop transfers or withdrawals.

## Active collections

Only the current public Characters and Trinkets deployments above are supported as native collections. Character selection, avatars, multiplayer authentication, native character models and trinket inventory use these addresses exclusively. The old collection environment variables are no longer read. Previously deployed contracts still exist; old trinket escrow withdrawals remain available directly through that contract, but its inventory and placed instances are no longer loaded by the app.

## External ERC-1155 placement

In Characters / NFTs / Containers, use External editions — ERC-1155. Enter a collection, token ID and quantity. Approve the collection for the edition escrow, choose a position, then confirm attachment. Approval is ERC-1155 `setApprovalForAll`, scoped to this collection and escrow. Attached units leave the wallet; the record and actual balance move atomically. Other wallet units remain untouched. Current parcel ownership controls repositioning and full withdrawal, including after parcel transfer.

Editions support terrain, foundation and solid-wall placement and appear in world and parcel showcase. Each attachment has a unique escrow ID, even for multiple displays of the same token ID. Container storage and partial withdrawals are not implemented for external editions; retrieve the complete attachment and reattach a smaller amount if needed. At most 64 edition attachments per parcel. Direct unsolicited transfers and batch deposits revert. No recovery/admin drain exists; use the attach function.

Rendering uses the existing bounded metadata/image loader. Collection transfer restrictions, unavailable metadata, blocked CORS, oversized media and unsupported image formats can still prevent attachment or artwork display. External animation URLs are not executed. BasePaint is not guaranteed to render if its live metadata/image service does not permit browser retrieval.

## Deployment and verification

`node --env-file=.env scripts/deploy-public-collections.mjs` simulates and estimates; `--broadcast` resumes its nonce-bound journal without duplicating deployments. The signer is never exported. Deployment verifies runtime bytecode and immutable bindings. Run `node --env-file=.env scripts/verify-public-collections.mjs` with `FORGE_BIN` and `ETHERSCAN_API_KEY` for BaseScan verification. Results are saved separately from deployment receipts.

Vercel's existing build command loads the public address configuration in `docs/deployments/doodverse-base.env.example`. No Vercel environment changes or vercel.json are required. Railway redeploys the updated presence server; it uses the latest character collection directly and ignores obsolete CHARACTER_ADDRESS / CHARACTER_ADDRESSES settings.
