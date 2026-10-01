# Doodverse on Base mainnet

Deployed October 1, 2026 on Base (8453). Owner/recovery authority: `0xdB6882db2a406bc1541988715842906dfd4fd590`. Total fee for 13 deployment/binding transactions: **0.000092131360839648 ETH**. No NFTs or items were minted by deployment.

| Contract | Address |
| --- | --- |
| DoodverseParcels | [0x383891F3537627Fb9E235f0242D874fe00Ca6443](https://basescan.org/address/0x383891F3537627Fb9E235f0242D874fe00Ca6443#code) |
| DoodverseParcelState | [0xe5F118e3edB6d22263e93809f0E89b13cebC2CDE](https://basescan.org/address/0xe5F118e3edB6d22263e93809f0E89b13cebC2CDE#code) |
| DoodverseItems | [0x702752974Bbc11CA323E373Ab70a4AF1dcB4982D](https://basescan.org/address/0x702752974Bbc11CA323E373Ab70a4AF1dcB4982D#code) |
| WorldItemState | [0x2581c828A63BbDD8245D62313eFBacB68ce615f1](https://basescan.org/address/0x2581c828A63BbDD8245D62313eFBacB68ce615f1#code) |
| PortalState | [0x199221143428Ba0895f222E63bF6db0b92c2fb89](https://basescan.org/address/0x199221143428Ba0895f222E63bF6db0b92c2fb89#code) |
| DoodverseNFTState | [0xA04562e822D0DA48804A4A1F395BeC4E0fF7C2aE](https://basescan.org/address/0xA04562e822D0DA48804A4A1F395BeC4E0fF7C2aE#code) |
| ContainerItemState | [0x5AE294C6F2632088592a59bb1c0fD01939aA638a](https://basescan.org/address/0x5AE294C6F2632088592a59bb1c0fD01939aA638a#code) |
| DoodverseCharacters | [0x03847D61A017731A843109F0b6BC637AF8a3f7e0](https://basescan.org/address/0x03847D61A017731A843109F0b6BC637AF8a3f7e0#code) |
| DoodverseTrinkets | [0x32CEb50081fD7e986cd32231b01157b45FD20B51](https://basescan.org/address/0x32CEb50081fD7e986cd32231b01157b45FD20B51#code) |
| DoodverseKeys | [0x81e9A62B167f88A546D996F151b59fcEB9c97D72](https://basescan.org/address/0x81e9A62B167f88A546D996F151b59fcEB9c97D72#code) |

**All ten contracts are verified on Basescan.** [Verification report](deployments/doodverse-basescan-verification.json) records each code URL and confirmed status.

[Public receipts](deployments/doodverse-base-mainnet.json) contain every transaction hash. [Public frontend configuration](deployments/doodverse-base.env.example) contains only addresses and RPC settings. Existing Atlas deployment reports and production configuration remain intact.

DoodverseParcels is public and free: automatic sequential IDs, up to five lifetime mints per wallet, and network gas only. Keys use the separate DoodverseKeys contract with per-lock IDs, guest copies, rekeying and ownership-epoch invalidation; see [Keys](KEYS.md). Parcel items, trinkets and characters retain owner-controlled distribution. Trinkets are still wallet collectibles and are not accepted by the utility-item escrow.

The deployer checked deployed runtime bytecode, immutable bindings, authorities, public mint configuration and the five-mint cap. Validation passed 58 Solidity tests, 42 runtime tests, local-chain integration and production build. These checks are not an independent security audit.

## Website activation

The production build now loads `deployments/doodverse-base.env.example`, switching the website and mint page to all ten new contracts together. No Vercel environment variables are required. Normal local development retains its mock defaults.

The original Atlas configuration remains archived in `deployments/atlas-base.env.example`; assets and state are not migrated. Both collections have immutable animation URLs pointing at this same origin without a collection identifier, so old Atlas animation URLs now display the new Doodverse parcel with that ID. An old-collection build using the archived configuration must be hosted separately to view the original state.

The legacy site still builds with `pnpm run legacy:build` → `build`. Publish `static/trinkets/` there before minting instrument editions. The Doodverse runtime uses `node scripts/build-atlas-base.mjs` → `app/dist`. No Vercel configuration changes are required by this deployment.
