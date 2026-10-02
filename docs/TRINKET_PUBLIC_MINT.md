# Trinket public mint

The replacement `DoodverseTrinkets` supports `mint(uint256 id)` for IDs 1–5. Anyone may mint to their own wallet for zero mint price plus gas, once per ID for life. `minted(wallet,id)` records the allowance before the ERC-1155 receiver callback. Failed receiver callbacks revert both the token and allowance. The compatibility three-argument mint selector accepts only the caller as recipient and quantity one, and uses the same allowance. There is no administrator bypass.

Transferring, selling or placing a token does not restore the original wallet's mint allowance. Receiving a transferred token does not consume the recipient's mint allowance. This limits minting, not balances; collectors can receive multiple copies. A wallet limit cannot identify unique people or stop use of multiple wallets.

## Deployment boundary

The existing Base Trinkets contract and WorldTrinketState escrow are immutable and unchanged. This source change requires a new Trinkets deployment and a new WorldTrinketState bound to that collection and the existing parcel collection. No contracts were deployed by this change. Do not simply change the token address while leaving the escrow address unchanged.

The mint page detects `PUBLIC_MINT()` and reads the selected wallet/ID allowance. Old deployments display a pending-deployment message and public minting stays disabled. The 3D previews work immediately, using the same packaged GLBs as in-world instruments, with independent GPU disposal when switching selections.

Before switching the runtime's token and escrow configuration, preserve a way to view and withdraw legacy attachments. Existing tokens cannot be moved into the new collection just by changing addresses. A migration or dual-provider release needs an explicit plan; existing deployments and metadata remain intact meanwhile.

## Verification

Foundry tests cover per-ID claims, independent wallets, invalid IDs/quantities, transfers, callback reentry and rejected receivers. Existing escrow capacity tests use a clearly test-only mint fixture so their bulk balances do not create an administrative bypass in the production contract. Local-chain integration checks the new mint and escrow/parcel-transfer lifecycle.

The collection metadata base is now `https://atlas-mu-lime.vercel.app/trinkets/metadata/`. On October 2, 2026, all 71 Foundry tests passed using the repository-local Forge binary, and the fresh-suite local-chain integration passed using the isolated Ganache install.
