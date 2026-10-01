# Fresh Doodverse collection and full suite

This prepares a new deployment; it does not migrate, mint, upgrade, or change the existing Base deployment. Existing assets and their custody remain with the old contracts. Deploy ten new contracts and bind the container item adapter. Do not reuse the old deployment journal or `scripts/deploy-atlas.mjs` for this suite.

## Contracts

| Role | Fresh artifact | Change |
| --- | --- | --- |
| Parcel ERC-721 | DoodverseParcels | New collection, generator revision 2 |
| Buildings | DoodverseParcelState | Schema 2, modular catalog and signed centimeter Y |
| Parcel utility inventory | DoodverseItems | Branded wrapper; existing item IDs and custody ABI |
| Attached items | WorldItemState | New deployment, new land/items bindings |
| Portals | PortalState | New deployment, new land binding |
| NFTs, containers, doors | DoodverseNFTState | Schema 2, elevated doors |
| Container items | ContainerItemState | New deployment, new NFT-state/items bindings |
| Distinct lock keys | DoodverseKeys | Epoch-bound ERC-1155 keys, rekeying and guest copies |
| Instrument collectibles | DoodverseTrinkets | Separate ERC-1155 IDs 1–5; hosted legacy instrument metadata |
| Characters | DoodverseCharacters | Doodverse collection name, symbol and metadata |

The seed remains 7422026, grid 100×50 and parcel size 64. Revision 2 records the current gentler terrain formula (16/3.5/0.6 amplitudes). Existing revision-1 runtime compatibility is retained; this does not restore an older terrain formula. Fresh DoodverseCharacters IDs 1–1000 reuse CryptoDoodz metadata at `https://3dnft.vercel.app/cryptodoodz/metadata/0001.json` through `1000.json`. These are new tokens with shared artwork, not a migration of the existing CryptoDoodz contract. The runtime safely displays the metadata image and traits; it does not embed the animation HTML.

Buildings use stable IDs, at most 128 objects per parcel, centimeter X/Z and signed centimeter absolute world Y in ±320 meters. Types 1–5 remain terrain anchored and require Y=0 onchain. Modular types 7–12 and 14–15 require quarter-turn rotations; IDs 6 and 13 are reserved for separate portal/door systems. Footprint validation matches the runtime. Removed toolbar primitives remain decodable.

Doors retain the existing `createDoor` terrain-anchored entry point. `createElevatedDoor` stores absolute world Y; `int32.min` represents terrain anchoring only in legacy-style door records. Door access is CHECK_ONLY and local visual state: it is not a security boundary for hiding blockchain data or preventing modified clients walking through walls.

Custody, current-owner authorization, attachment inheritance, container capacity, nonempty deletion protection and delayed rescue rules remain unchanged. No inventory minting or starter parcel minting occurs in the deployment script. Parcel minting is public and free immediately after deployment, limited to five lifetime mints per caller with automatic sequential IDs. Character/item authorities retain their mint permissions.

## Verification before deployment

```sh
npm test
npm run build
forge test --root contracts
npm run world:fresh:integration
```

The integration command compiles with installed solc 0.8.30 into ignored `artifacts/atlas-v2`, deploys the full suite on an ephemeral Ganache chain, and tests modular height persistence, elevated doors, NFT/container custody, parcel transfer and new-owner withdrawal. Existing integration commands still target schema 1.

## Deployment configuration

Set these in your shell (public values, no private key):

```text
FRESH_CHAIN_ID=8453
FRESH_DEPLOYER=0xdB6882db2a406bc1541988715842906dfd4fd590
FRESH_OWNER=0xdB6882db2a406bc1541988715842906dfd4fd590
FRESH_SEED=7422026
FRESH_RUNTIME_URL=https://atlas-mu-lime.vercel.app/
FRESH_ITEM_URI=https://atlas-mu-lime.vercel.app/metadata/items/{id}.json
```

First run a **simulation** against the chosen Base RPC:

```sh
forge script contracts/script/DeployFreshAtlas.s.sol:DeployFreshAtlas --root contracts --rpc-url "$BASE_RPC_URL" --sender "$FRESH_DEPLOYER"
```

There is no `--broadcast` in that command. For an offline local-EVM rehearsal replace `--rpc-url ...` with `--chain 8453`. The script itself is a local orchestrator, not a ninth contract to deploy; its large bytecode is not deployed to Base.

When deployment is explicitly requested, use the same script with the authorized Foundry keystore/hardware wallet and `--broadcast`, then verify contracts. Do not put private keys into VITE variables, command history, source files or documentation. Inspect simulated transactions and estimated fees first. Save Foundry receipts under a distinct fresh-suite deployment record. If execution is interrupted, inspect receipts and resume the exact pending transaction sequence rather than rerunning and creating another suite.

After deployment, verify every binding, schema version, authority, generator revision, and empty initial supply/state. Confirm `DoodverseNFTState.containerItems` is bound to the new adapter. The signer owns NFT state during binding, then transfers recovery authority to FRESH_OWNER if different. Record all ten addresses and transaction hashes; do not infer addresses from the old deployment.

## Website cutover

Copy the public template in `deployments/atlas-base-fresh.env.example` within this docs directory, fill all ten addresses from confirmed receipts, and validate bindings in the runtime. Update the public production configuration only as a separate cutover. Never mix old and new state/land addresses. The current `atlas-base.env.example` and mainnet journal are deliberately untouched.

Both collections currently use the same runtime origin and token-ID URL format. Switching its default collection will also change what old animation URLs render. Preserve the old collection on a dedicated runtime route/origin (or implement explicit collection routing) before the website cutover if old NFT interactive views must remain available. The fresh deployment preparation does not perform that routing migration.

Old escrow assets do not automatically move. Current controllers must explicitly withdraw/re-attach assets to the new collection if desired; rebuilding old structures is a separate migration decision. New contracts begin empty.

## Storage and compatibility

The providers detect schema 1 or 2 before decoding and enable modular tools only for schema 2 (or mock mode). No custom graphics code depends on contract storage layout. Schema-1 tests and contracts remain intact. Fixed heights persist exactly; snapping and support relationships remain presentation behavior rather than onchain structural physics. Direct storage costs grow per object/asset; this remains a bounded MVP and can later use compressed commitments or other provider implementations.

## Preparation verification (2026-09-29)

- 50 Foundry tests passed, including old and new suites and 256-run fuzz cases.
- 39 runtime tests and 54 legacy tests passed.
- Strict TypeScript check and production build passed.
- Schema-1 building/NFT integration and fresh-suite integration passed on Ganache.
- DeployFreshAtlas completed an offline chain-8453 dry run (9,750,943 simulated gas; not a fee estimate).
- No public-chain transaction was sent and no production configuration was changed.

This workstation used an isolated Foundry npm executable under ignored `work/foundry-test-tools`, and `NODE_PATH` pointing at the isolated Ganache bundled dependencies under `work/atlas-test-tools/node_modules/ganache/node_modules` to work around an incomplete existing pnpm installation. Legacy tests on Node 22.12 also needed `NODE_OPTIONS=--experimental-strip-types`; supported newer Node releases enable this automatically. These local tool repairs do not change application dependencies. Ganache's native transport was unavailable, so its JavaScript fallback was used.

## Separate utility and instrument collections

DoodverseItems is named **Doodverse Parcel Items** and retains all six utility IDs and original escrow bindings. DoodverseTrinkets has five independent instrument IDs, owner-only minting and metadata at `https://3dnft.vercel.app/trinkets/metadata/1.json` through `5.json`. The deployment emits `TrinketsDeployed` in addition to `FreshSuite`. The new suite has ten contracts and does not mint automatically.

Set `VITE_DOODVERSE_TRINKETS_ADDRESS` only to the new trinket address. Do not substitute it into utility configuration or key requirements. It enables an independent mint selector. World placement/container custody for instruments is not implemented by the utility escrow. Publish `static/trinkets/` through the existing legacy build; keep the Doodverse build command and both output directories unchanged. No Vercel configuration file is introduced.

### Collection split verification (2026-10-01)

52 Solidity tests and 40 runtime tests passed. Fresh-suite local integration passed, including separate instrument/utility balances. Both exact hosting commands succeeded (`pnpm run legacy:build` → `build`; `node scripts/build-atlas-base.mjs` → `app/dist`). The updated nine-contract deployment completed an offline chain-8453 dry run using 11,044,514 simulated gas; this supersedes the older eight-contract rehearsal above and is not a live fee quote. Nothing was broadcast or minted on Base.

Experimental contracts use descriptive Doodverse names without version suffixes. Internal schema and terrain revision numbers remain unchanged because providers use them to decode data safely. There is no vehicle contract in the suite.

The final live deployment uses `scripts/deploy-doodverse.mjs` with a separate `deployments/doodverse-base-*` journal, ten creations and three binding calls. `scripts/verify-doodverse.mjs` submits each exact Foundry artifact and constructor arguments to Basescan through Etherscan. Supply and recovery authorities stay with the configured owner; no automatic minting occurs. See [Keys](KEYS.md) for the new access rules.
