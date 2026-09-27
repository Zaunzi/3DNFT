# Atlas on Base mainnet

The eight contracts below are deployed on chain **8453**, with nine successful transactions including the one-time container-custody binding. **No NFTs or items were minted.** All owner/minting/recovery roles belong to `0xdB6882db2a406bc1541988715842906dfd4fd590`.

Canonical seed: `7422026`. Topology: 100 × 50 parcels, 64 world units each. Permanent metadata runtime URL: `https://atlas-mu-lime.vercel.app/`. These values preserve the existing procedural world.

| Contract | Base mainnet address |
| --- | --- |
| WorldParcelNFT | [0xAe4b6B896e53E596e5dC97594e3Ef14b0e4414d4](https://basescan.org/address/0xAe4b6B896e53E596e5dC97594e3Ef14b0e4414d4) |
| ParcelState | [0xdf102c4bdd07B456064E85cC70Ed85bab254EB4D](https://basescan.org/address/0xdf102c4bdd07B456064E85cC70Ed85bab254EB4D) |
| AtlasItems | [0xFD4fb9C2457Ec28De05860f993f8dACE01D94FCB](https://basescan.org/address/0xFD4fb9C2457Ec28De05860f993f8dACE01D94FCB) |
| WorldItemState | [0xdBE1B626a4815fc104F22Eb84dc0b4078b4B8B28](https://basescan.org/address/0xdBE1B626a4815fc104F22Eb84dc0b4078b4B8B28) |
| PortalState | [0xe22a5487eed81ff2C8079E8319fe1fAc4A8F96D8](https://basescan.org/address/0xe22a5487eed81ff2C8079E8319fe1fAc4A8F96D8) |
| WorldNFTState | [0xCe937A13D1Ab9AA3cA2694030Bd85Dc4e7aF0d9F](https://basescan.org/address/0xCe937A13D1Ab9AA3cA2694030Bd85Dc4e7aF0d9F) |
| ContainerItemState | [0x2343C663D0E1Ea3D18b9e6b1e395741CE5577b9D](https://basescan.org/address/0x2343C663D0E1Ea3D18b9e6b1e395741CE5577b9D) |
| AtlasCharacters | [0x959Ddc30fAe546C3A2b3924afF1c20131e22EF05](https://basescan.org/address/0x959Ddc30fAe546C3A2b3924afF1c20131e22EF05) |

[Public receipt report](deployments/atlas-base-mainnet.json) records transaction hashes, blocks and fees. Total deployment fee: **0.000065531253049751 ETH**. Runtime bytecode (with compiler immutable slots normalized), owner roles, canonical seed/runtime and every custody binding were checked against the local artifacts. Existing contracts were not modified. All 26 Foundry tests and 23 runtime tests passed before completion.

## Runtime connection is separate

All eight contracts also received **exact-match source verification on Sourcify**. For example, inspect [WorldParcelNFT on Sourcify](https://repo.sourcify.dev/contracts/full_match/8453/0xAe4b6B896e53E596e5dC97594e3Ef14b0e4414d4/). Source verification is distinct from a security audit and from a Basescan verification badge.

The Vercel production build runs `node scripts/build-atlas-base.mjs`, which loads the checked-in public Base configuration and produces `app/dist`. All eight contract addresses are bundled into the runtime. Local `npm run dev` and `npm run build` retain their existing mock/environment defaults.

To connect a runtime later, copy [public environment configuration](deployments/atlas-base.env.example) into `app/.env.local` for development, or set those public `VITE_*` values in the production build environment and rebuild. Never put a private key into a frontend environment variable. Parcel #742 is unminted; exploration works, but nobody can build there until the contract owner explicitly mints it in a separate transaction.

AtlasItems uses `https://atlas-mu-lime.vercel.app/metadata/items/{id}.json`, with ERC-1155 lowercase 64-character hexadecimal IDs. Six static metadata/image pairs are prepared under `app/public/metadata/items/`; the website release publishes these alongside the runtime. Parcel metadata and fallback SVG, and character metadata, are generated onchain.

## Deployment tooling

`scripts/deploy-atlas.mjs` defaults to local simulation and read-only RPC checks. `--broadcast` sends the fixed deployment sequence and records every signed transaction before submission in the ignored `deployments/` journal. Keep that journal to prevent duplicate deployments and to resume interrupted confirmation checks. It never mints. Do not run a fresh deployment when intending to interact with these existing contracts.

`node --env-file=.env scripts/deploy-atlas.mjs --verify` rechecks deployed bytecode and configuration. `node scripts/report-atlas-deployment.mjs` audits the recorded receipts. The script uses `DEPLOY_PRIVATE_KEY` only locally; no signer material is included in the public report or environment example. The fee guard checks capped L2 gas plus current L1/operator estimates; changing L1 fees mean it is not an absolute protocol-enforced total fee cap.

The deployment uses Solidity 0.8.30, optimizer 200, Shanghai target, and OpenZeppelin 5.4.0. Contracts retain the documented experimental trust model, including the delayed unregistered-NFT recovery authority; deployment is not a security audit.

