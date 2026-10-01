# Doodverse — shared procedural NFT world

Each parcel ERC-721 represents a place in one continuous, deterministic world. Owners can place objects, attach ERC-1155 items and ERC-721 NFTs, use containers, and create portals and key-gated doors. Attached assets follow the land when it transfers. This runtime uses TypeScript, Vite, Three.js, viem, Solidity and Foundry; ethers remains for compatibility. The existing Cloudacre application remains available through `legacy:*` commands; its documentation is in [docs/CLOUDACRE_LEGACY.md](docs/CLOUDACRE_LEGACY.md).

## Run

Use Node 22.14+ (Node 24 recommended):

```bash
npm install
npm run dev
```

The root URL opens the lightweight Doodverse landing page with world entry, minting and a parcel lookup. Direct links such as **http://localhost:5173/?tokenId=742** still open the world. Click **Enter world**, then use WASD, Space to jump, mouse look and Shift to sprint. Esc releases/pauses. If pointer lock is unavailable in an embedded viewer, hold and drag the terrain to look. Use the checkboxes to toggle parcel borders and diagnostics.

You spawn in parcel #742 at grid (42, 7), facing east toward #743. Walk about 32 world units (four seconds at walking speed) to cross its border. The token label, ownership notice, coordinates and URL update without reloading. A radius-two neighborhood is generated in advance. World edges stop movement. Trees and rocks are decorative; terrain has collision.

The default is **MOCK STATE** with seed 7422026. Click **Use mock owner**, then **B** to build on parcels 742, 743 or 744. Choose a piece from the toolbar (**4** Tree, **5** Rock, **6** Portal), **R** to rotate, and click terrain to place. Choose **Select / Remove**, click a saved object, then press **Delete** to remove it. **Esc** clears selection; **B** exits build mode. Objects survive refresh in localStorage and render in neighboring loaded parcels. No deployment or wallet extension is required.

For real ownership and writes, copy `app/env.example` to `app/.env.local`, choose `onchain` mode, and set chain ID, RPC, NFT and ParcelState addresses. Connect MetaMask/Rabby; only the current parcel owner can modify state. Anonymous exploration remains available. Restart Vite after environment changes. Never put private keys into frontend variables.

Read [Persistent world architecture](docs/PERSISTENT_WORLD.md) for the ownership diagram, state provider abstraction, environment variables, object encoding, gas limitations and migration strategies.

**Phase 4:** Open **NFTs / Containers**, select a development NFT, approve it and attach it to the parcel floor or a chest. E inspects nearby assets/containers or checks a door; I opens ERC-1155 inventory. The panel provides explicit Move/Store/Detach controls and mock Alice/Bob land-transfer controls. Refresh preserves custody state. [NFT attachments](docs/NFT_ATTACHMENTS.md) documents the complete workflow, recovery trust model, safe metadata handling and deployment variables. [Items and portals](docs/ITEMS_AND_PORTALS.md) covers the Phase 3 runtime and portal build option 6.

## Modular building prototype

Run `npm run dev:mock` for the expanded local build catalog: foundations, walls, doorways, window walls, roofs, lanterns and key-checked doors. The new Base Doodverse deployment supports these modular buildings onchain; see [deployment addresses](docs/DOODVERSE_BASE_DEPLOYMENT.md). The older Atlas collection remains separate. See [Modular building](docs/MODULAR_BUILDING.md) for snapping, elevation and a room layout.

## Embedded NFT viewer

Doodverse has three lazy-loaded presentation modes: landing, world and showcase. Iframes (including OpenSea), `?mode=showcase`, and the legacy `?embed=1` preview use a living parcel diorama: one globally generated parcel, persistent objects/items/portals/NFTs, a slow orbit camera and a cutaway base. No player, WASD, wallet UI or gameplay interactions are created. The orbit respects reduced-motion preferences, can be paused, pauses rendering while hidden, and is capped at 30 FPS. Persistent state refreshes every minute while visible. **Open in Doodverse** preserves the parcel ID and opens `?mode=world` in a new tab. Full-window visits without parcel parameters show the landing page without initializing WebGL or blockchain providers. Direct `?tokenId=…` links and explicit `?mode=world` use the first-person world. Metadata/contracts require no update.

## Mint on Base

Open [Mint assets](https://atlas-mu-lime.vercel.app/mint.html), connect the contract-owner wallet and switch to Base. Mint a parcel (0–4999), a character (start with #1), or one of the six Doodverse items to your chosen recipient. Each action simulates first and requires a separate wallet-confirmed transaction. Duplicate ERC-721 IDs and unauthorized mints revert. No minting occurs automatically. Open the minted parcel, connect its owner, and use Inventory or NFTs / Containers to attach assets.

Vercel needs no additional environment variables: `scripts/build-atlas-base.mjs` loads the public configuration in `docs/deployments/doodverse-base.env.example`. Never add private keys to Vercel or `VITE_*` variables. Local mock mode remains unchanged; the mint page requires the Base production build or equivalent local onchain configuration.

## Verify and build

```bash
npm test
npm run world:check
npm run build
npm run preview
# Optional end-to-end viem integration (requires forge):
npm run world:integration
# NFT/container-only local integration:
npm run world:nfts:integration
```

`npm test` covers all 5,000 coordinate round trips, finite boundaries, URL validation, deterministic generation, seed high bits, actual mesh edge heights/normals/colors, collision interpolation, and streaming retention/disposal. The production artifact is `app/dist/`; serve it from any static host. Relative asset URLs support deployment under `/nft/`. Configure the public base URL accordingly when deploying the contract.

Foundry must be installed separately with `forge` on PATH. OpenZeppelin is installed by `npm install`:

```bash
forge test --root contracts -vv
# Equivalent: npm run world:contracts:test
```

Tests cover the original NFT behavior plus owner-only placement/removal, transfer-based permissions, approved-operator denial, events, footprint/rotation/type validation, capacity, stable IDs and fuzzed inputs. Foundry uses `contracts/world-test/` to keep these suites separate from legacy tests.

`contracts/script/DeployWorld.s.sol` reads `WORLD_SEED`, `WORLD_RUNTIME_URL` (HTTPS, trailing slash, no query), and `WORLD_OWNER`. A dry run:

```bash
forge script contracts/script/DeployWorld.s.sol:DeployWorld --root contracts --rpc-url YOUR_RPC
```

The eight original Atlas contracts are deployed on **Base mainnet (8453)**. No parcels, items or characters were minted during deployment. See [Base deployment](docs/BASE_DEPLOYMENT.md) for addresses, receipts, owner roles and optional runtime configuration. The seed/topology/version and runtime URL have no setters. This is an experimental contract, not an audited production sale.

## Layout and architecture

- `app/src/world/`: coordinates, constants, seeded noise, terrain/collision, vegetation, parcel meshes and streaming.
- `app/src/player/`: first-person movement and pointer lock/drag controls.
- `app/src/blockchain/`: wallet lifecycle, ownership, configuration, mock/localStorage and viem onchain providers; preserved ethers adapter.
- `app/src/objects/`, `app/src/build/`: primitive registry, persistent streaming layer, raycast preview/selection and build toolbar.
- `app/src/debug/`: runtime diagnostics.
- `contracts/src/WorldParcelNFT.sol`: bounded ERC-721 collection, canonical seed/topology, minimal parcel version and metadata.
- `contracts/src/ParcelState.sol`: separate owner-authorized object storage with compact fields, stable IDs, 128-object cap and events.
- `contracts/world-test/`, `contracts/script/`: Foundry tests and deployment script.

The world is a 100 × 50 grid of 64-unit parcels. All terrain/decorations derive from global coordinates and the collection seed. Neighboring meshes share exact border samples, including normals; tokens do not seed independent scenes. At most 25 parcels are retained. Generation is versioned independently of mutable parcel state. Read [docs/WORLD_ARCHITECTURE.md](docs/WORLD_ARCHITECTURE.md) for invariants, metadata behavior and future extension points.

Persistent edits, item inventory, escrowed NFT attachments, static characters, containers, internal portals and CHECK_ONLY doors are implemented. Messages, quests, multiplayer, moving characters/vehicles and detailed buildings remain deferred. Procedural generation is unchanged; persistent state layers on top. Objects use local X/Z centimeters and derive Y from terrain. Each primitive contract object occupies one storage slot; custody records use additional slots and indexes. 100 placements still incur significant storage and transaction costs. Provider interfaces allow a future storage strategy without rewriting Three.js.

Phase 4 modules live under `app/src/nfts/`. New contracts are `WorldNFTState`, `ContainerItemState`, and owner-minted `AtlasCharacters`. ERC-721s use per-token approvals and real escrow in onchain mode. The recovery authority can recover only unregistered unsafe deposits after a seven-day delay; it cannot take registered attachments. SVG/HTML/animation metadata is never executed. Doors govern local interactions, not secret content or an authoritative onchain player position.

## Existing application

`npm run legacy:dev` opens the prior Cloudacre application on port 3000. `legacy:build`, `legacy:preview`, `legacy:test` and `check` retain the original workflows. Existing contracts, routes, assets and uncommitted user files are preserved. The new runtime reads only environment files under `app/`.

Attached item ownership: selling or transferring land transfers the claim to items still attached to it. See [attached item ownership](docs/ATTACHED_ITEM_OWNERSHIP.md).

### Gentler terrain tuning

The runtime now uses broad/rolling/detail amplitudes of 16 / 3.5 / 0.6 (previously 26 / 7 / 1.5). Global-coordinate sampling, seed, topology, and seam matching remain deterministic, but elevations differ from earlier runtime builds. Terrain-anchored scenery follows the new ground. Explicit-height mock buildings and doors keep their saved heights and may need repositioning; no saved state is silently rewritten. This is a runtime terrain tuning revision, not a contract or metadata generator-version migration. Historical runtime bundles render the previous terrain.

Cube, Platform and Pillar are retired from the build toolbar and keyboard shortcuts. Existing saved instances still render and remain removable. New mock build sessions start with Foundation selected.

## Doodverse branding

The runtime and fresh collection now use Doodverse. The existing `atlas-mu-lime.vercel.app` address remains active; no new domain is assumed. Existing deployed contracts retain their immutable collection names. Fresh deployment uses Doodverse Parcels (`DOODLAND`), Doodverse Characters (`DOODCHAR`) and Doodverse Parcel Items (`DOODPARCELITEM`) and Doodverse Trinkets (`DOODTRINKET`).

Legacy `VITE_ATLAS_*` configuration keys, script filenames, `INTERNAL_ATLAS` portal tags and `atlas:` localStorage keys remain compatible so this rebrand does not orphan saved builds, inventory or deployments. Historical deployment reports retain their original names and addresses.

## Two sites and separate item collections

- Legacy SvelteKit: `pnpm run legacy:build`, output `build`, hosted at `https://3dnft.vercel.app/`. CryptoDoodz metadata and instrument experiences remain here.
- Doodverse: `node scripts/build-atlas-base.mjs`, output `app/dist`. No vercel.json is required or added.

The fresh ten-contract suite keeps six utilities in **Doodverse Parcel Items** (`DoodverseItems.sol`, legacy `VITE_ATLAS_ITEMS_ADDRESS` setting). **Doodverse Trinkets** is a separate ERC-1155: 1 Afterhours, 2 Nocturne 88, 3 Backbeat, 4 Prism, 5 Barrio. Configure `VITE_DOODVERSE_TRINKETS_ADDRESS` after deployment to enable its separate mint option. An absent trinket address does not disable existing collection minting.

Generate instrument metadata with `node scripts/generate-trinket-metadata.mjs`; commit the output under `static/trinkets/` and deploy the legacy site before minting. Metadata uses the existing playable `/items/1/` through `/items/5/` pages, with simple SVG covers. These HTML instruments are not automatically embedded inside the world. Trinkets support world placement through their own escrow. Left-click a nearby instrument to open its sandboxed playable controls. Containers still accept only the utility contract. Holding Prism #4 does not satisfy a Key #4 requirement. See [Trinket placement](docs/TRINKET_PLACEMENT.md).

## Public parcel minting (fresh deployment)

DoodverseParcels opens free public minting immediately on deployment. Call `mint(quantity)` with 1–5; the contract assigns consecutive IDs from 0 to 4999 to the caller. No ID selection, recipient selection, allowlist or owner bypass. Each wallet may mint at most five over its lifetime, across all transactions. Transfers do not reset this allowance or prevent receiving additional parcels. Minting is nonpayable; users pay network gas only. Failed receiver callbacks revert the entire batch and counters. Multiple wallets have separate limits; this is not a per-person limit.

The mint page detects the fresh contract, shows remaining allowance, and links to assigned parcels from confirmed mint events. The production website now uses the public-mint Doodverse collection. Character, utility and trinket minting retain their existing authority rules.

Distinct lock keys are documented in [Keys](docs/KEYS.md). They use a separate DoodverseKeys ERC-1155 contract; utility Key #4 is retained only for legacy/shared-key requirements.

The fresh ten-contract Doodverse suite is deployed on Base: [addresses and activation notes](docs/DOODVERSE_BASE_DEPLOYMENT.md). The older Atlas deployment remains separate.

## Placeable Trinkets

Open **Inventory [I] > Collection > Trinkets**, select an instrument, approve its separate escrow, and use **Place near player** (quantity 1). Aim at it and **left-click** to play, or press **E** to pick it up as the parcel owner. Closing the playable panel stops its audio. Placed instruments follow parcel ownership. See [Trinket placement](docs/TRINKET_PLACEMENT.md) for contracts, model export, mock mode, and limitations.
