# Doodverse: world parcels, generator v1

> This document records the Phase 1 terrain/runtime architecture. For implemented wallet connection, ownership-controlled edits, state contracts and current hosting/storage behavior, see [Phase 2](PERSISTENT_WORLD.md), which supersedes the future-state sections below. Terrain invariants remain unchanged.

## Canonical state versus rendering

`WorldParcelNFT` fixes the collection seed, generator version, 100 × 50 topology and 64-unit parcel size. ERC-721 owns the location. `WorldStateProvider` supplies identity and parcel ownership/version to the renderer; it contains no Three.js objects. The default mock adapter is clearly labeled. The ethers adapter is loaded dynamically only when configured, checks chain ID and topology, and rejects an unsupported generator version. Unminted parcels remain traversable land; minting does not create terrain. RPC failures are displayed rather than silently replaced with mock ownership.

Token IDs are zero-based, in [0, 4999]. Token #742 maps to (42, 7), east to #743, west to #741, north to #642, south to #842. +X means east and +Z south. The outer boundary is finite and movement is clamped; there is no wrap from column 99 to column 0. A parcel owns a half-open rectangle `[x*64,(x+1)*64) × [z*64,(z+1)*64)`. Meshes include the closing edge to join their neighbors.

Changing topology requires changing/versioning the canonical contract and its runtime together. It must never silently reinterpret existing minted tokens. Likewise, generation changes need a new generator version and a runtime that preserves older versions. The mock seed is only a development value; a deployed collection reads its seed from the contract.

## Deterministic terrain and decorations

All uint256 seed bytes are folded into a deterministic 32-bit hash; collisions are possible, as with any such reduction. Seeded gradient Perlin noise is sampled at global coordinates at three frequencies. Terrain vertices use a globally aligned 2-unit lattice. Border normals use a global finite difference, not per-mesh averaging, so adjacent parcels have equal heights, normals and colors. Mesh indices and collision use the same triangle diagonal. The mathematical noise surface between vertices is not used for collision: the player follows the piecewise planar rendered surface.

Trees and rocks are generated from a global 8-unit cell lattice. Each half-open cell has at most one deterministic jittered candidate, and each parcel owns its cells exactly once. Meshes are instanced per parcel. No application procedural code uses `Math.random()`, clocks, or wallet addresses. Three.js may internally use randomness for resource UUIDs; these do not influence generation.

Terrain, decoration and collision are presentation interpreted from canonical identity. They are not individually stored onchain. The runtime has no authoritative simulation, multiplayer, or database. Floating point evaluation is stable for the same inputs in this JS implementation; it is not a cross-language consensus protocol.

## Streaming and movement

The manager retains a Chebyshev-radius-2 neighborhood: at most 25 parcels, fewer at world edges. It generates only additions and disposes outgoing mesh/material/instance resources. Two rings are present before the player reaches a boundary. Terrain outside the loaded area fades into fog before the draw boundary (fog far 122, minimum loaded extent 128 units). Streaming is synchronous for this MVP; very slow devices may briefly hitch when generating the outer row. Move generation to a worker or queue if measurement warrants it.

Movement uses a capped frame delta, normalized diagonal input, yaw-relative walking, sprint and terrain following. Trees and rocks are decorative and have no collision. The world boundary clamps position. Pointer lock requires a user gesture; if an embed refuses it, drag-to-look takes over. Esc pauses. Each crossing updates the HUD and shareable tokenId URL without a page navigation. Asynchronous ownership reads use request IDs so an older response cannot overwrite the newly occupied parcel.

## Future interfaces, intentionally not implemented

- Buildings/objects: extend parcel state with a content-addressed modifications root or a separate owner-authorized storage contract. Use parcel-local quantized transforms, schema versions and deterministic interpretation. Validate placement bounds on the authoritative write path.
- Portals: use `{chainId, contractAddress, tokenId}`, with destination identity/version resolution before travel. Portals across collections do not imply shared terrain continuity.
- Items and characters: reference ERC-1155/721 contracts separately from location ownership.
- Messages: verify owner signatures with chain/contract/token/nonces for replay protection; do not treat arbitrary remote text as executable content.
- Quests: isolate condition reads from rendering and distinguish local visit hints from authoritative proofs. A client-reported visit is not a trustless onchain fact.
- Wallet connection: a separate optional input adapter can provide the connected account. Reading and traversing this MVP never requires a wallet.

## Metadata and hosting

Minting is owner-only for this prototype, with bounds and duplicate protection. There is no sale, modification API, or deployment in this change. `tokenURI` requires a minted token and returns base64 JSON with an onchain SVG fallback, X/Z/version attributes, a decimal string seed, and `runtimeURL + '?tokenId=' + tokenId`. The original deployed runtime URL is fixed at construction. Current contract sources add owner-only mint pause and metadata/runtime URL setters; see [Collection administration](COLLECTION_ADMIN.md). Runtime URLs still require a trailing slash and no query/fragment. Hosted code can change independently of a URL.

`app/dist` is a static HTML/CSS/JS bundle with no backend, external textures, fonts or CDNs. Mock mode needs no network after assets load. The main JS is approximately 137 kB gzip; the optional ethers chunk approximately 94 kB gzip. Vite may emit a 500 kB uncompressed chunk advisory due to Three.js. This is a multi-file build, not yet a single-file/data-URL artifact. Future IPFS/Arweave packaging must pin both the runtime and generator version and account for marketplace iframe/WebGL/pointer-lock policy. A normal hosted URL is used for this milestone.

Implementation references: [Three.js PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html), [OpenZeppelin ERC-721](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721), [OpenZeppelin access control](https://docs.openzeppelin.com/contracts/5.x/access-control).
