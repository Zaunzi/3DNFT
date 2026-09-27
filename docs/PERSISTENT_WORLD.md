# Persistent owner-controlled parcels — Phase 2

```text
               ERC-721
                  |
             Parcel Owner
                  |
             ParcelState
                  |
          +-------+--------+
          |                |
     World Objects     Object Events
          |                |
          +-------+--------+
                  |
            State Provider
                  |
           Three.js Runtime
                  |
   Procedural World + Persistent Objects
```

## Ownership

The original `WorldParcelNFT` is unchanged. A separate `ParcelState` contract binds immutably to it. Every mutation calls `land.ownerOf(tokenId)`; only that address can build. Approved operators cannot build. Transfer immediately hands rights to the new owner while retaining objects. Unminted tokens cannot be modified.

The runtime uses viem public and injected wallet clients. Exploration does not require an account. Connect requests wallet access; account/chain/disconnect events invalidate UI permissions. Writes reread wallet state, simulate the call, check account/network again, send, and await a successful receipt. The contract remains authoritative if ownership changes before mining. Disconnect is local and does not revoke extension permissions. The ethers adapter/dependency remains for Phase 1 and legacy compatibility.

## Encoding and bounds

One world unit equals 100 coordinate units. X/Z are unsigned parcel-local centimeters: 10.25 units is 1025. World position is parcel origin plus stored coordinates divided by 100. Rotation is hundredths of a degree, 0–35999. Types 1–5 are Cube, Platform, Pillar, Tree and Rock.

```solidity
struct WorldObject {
    uint32 id;
    uint8 objectType;
    uint16 x;
    uint16 z;
    uint16 rotation;
}
```

The fields occupy 11 bytes, but **each struct array element uses one full 32-byte storage slot**. X/Z need only 0–6400 cm, so uint16 suffices. IDs are monotonic per parcel, start at 1, and are never reused. Solidity checked arithmetic prevents overflow. A uint32 revision increments on every mutation. No arbitrary URLs or strings are stored per object.

Y is omitted in schema 1. Preview and rendering quantize X/Z first, then use the unchanged `getGroundHeight(globalX, globalZ, seed)`, matching the rendered mesh. Object origins are at their base. This saves storage and prevents inconsistent stored heights, but cannot express stacking or vertical offsets. On slopes the base center is grounded; large flat platforms do not conform to terrain and may intersect/overhang at the edges. A future schema could add a signed offset. Generator v1 must remain available because terrain changes would move anchored objects.

Contract and frontend validate types, coordinate/rotation ranges, and a conservative circular footprint fully inside the parcel. Radii in centimeters are 142, 361, 80, 200 and 120 for types 1–5. These enclose the geometry at any rotation; some valid near-edge orientations are intentionally rejected. Future visuals must fit these footprints or use a new schema. Objects are decorative: no overlap prevention, structure physics, or object collision is implemented.

## Gas and storage limits

There is a maximum of **128 active objects per parcel**. A single `getObjects(tokenId)` returns its bounded snapshot; there is no RPC per object. Placement writes an object slot, array length and packed next-ID/revision counters. Removal scans at most 128 objects, swaps the last into the removed slot, and pops the array. IDs remain stable even though array order changes. This avoids shifting storage and saves an ID-to-index mapping slot per object, at the cost of bounded O(n) reads.

100 objects still consume roughly 100 object slots (3.2 KB) plus metadata and, with this UI, 100 transactions. New storage writes, transaction overhead, logs and chain-specific fees are substantial. Direct L1 storage is a prototype choice, not an economical large-world solution. Use `forge test --root contracts --gas-report` to measure the implementation; actual costs depend on the network. L2 is a plausible next deployment target.

`ParcelStateProvider.getObjects(bigint)` and `ParcelStateWriter.addObject/removeObject` isolate storage from rendering. Future providers could use calldata/event replay, compressed snapshots, IPFS commitments, Merkle roots, L2, blobs, or decentralized state networks. Commitments require data availability; blobs require retention beyond their availability window; event replay needs checkpoints and reorg handling. Migration must retain authorization, stable IDs, schema semantics and reconstruction. These alternatives are not implemented in this phase.

## Mock mode and persistence

Click **Use mock owner** to simulate address `0x1111…1111`, owning 742, 743 and 744. Configuration is centralized in `config.ts` and environment variables. Other parcels use another simulated owner. No wallet extension, signature, deployment, or database is needed.

Local records use `atlas:7422026:generator1:objects:v1:<tokenId>`, storing schema, nextId and objects. Reads validate the data, IDs, limits and placement bounds. Quota/blocked storage failures are reported rather than claiming success. Refreshing or streaming away and back retains objects. Clearing browser data deletes them, and different browsers/devices do not share them. Mock identities/storage are editable and not cryptographic security. Simultaneous tab writes can be last-writer-wins; this is not a multiplayer store.

Same-tab mutations and other-tab storage events invalidate snapshots. Manual, focus and 30-second refresh reconcile loaded state. Only the mock provider knows about localStorage.

## Streaming and events

Terrain generation and coordinates are unchanged. The persistent layer follows the existing 5 × 5 loaded neighborhood, fetching one snapshot per parcel and rendering independent groups. Objects in neighboring parcels remain visible. Geometries/materials are shared; unloading detaches and clears groups, and shutdown disposes shared resources. Entry identities and request counters reject stale responses after unload/reload or overlapping reads.

Onchain subscriptions poll ObjectPlaced, ObjectRemoved and NFT Transfer logs with explicit cancellation, a two-block overlap and a bounded 2,001-block query window. No server-side filter cleanup is required when an RPC goes offline. Logs invalidate snapshots rather than acting as the database. Current contract reads make duplicate events harmless. Manual/focus/periodic refresh recovers missed events and reconciles reorgs or changes beyond the log window. RPC errors remain visible; last successfully rendered objects may remain while reads fail, and building waits for a successful state read. Ownership-read failures revoke local permissions. One confirmation is UI feedback, not irreversible finality.

The builder captures its target token, serializes pending writes and does not optimistically render unconfirmed objects. Wallet rejection/reverts are shown. Account changes cannot retarget the submitted operation. This is event-based synchronization of persistent state, not player multiplayer.

## Controls

Connect/use the owner, then **B** or **Build**. Walking pauses and pointer lock releases. Move the cursor over terrain: green previews are valid, red are invalid. **1–5** selects a type; **R** rotates 15°. Click terrain to place. Click a persistent object to highlight it; **Delete** or **Remove selected object** removes it. **Esc** clears selection. **B** exits; click Enter world to walk again.

Only the currently occupied parcel is editable; walk into an owned neighbor first. Selection targets only persistent scene groups, so procedural trees/rocks cannot be deleted. Terrain raycasts target only marked terrain meshes. Persistent objects have no collision in this phase.

## Configuration and deployment

Copy `app/env.example` to `app/.env.local` and restart Vite. All VITE values are public.

| Variable | Meaning/default |
| --- | --- |
| VITE_WORLD_STATE_MODE | mock by default, or onchain |
| VITE_MOCK_OWNER_ADDRESS | simulated owner, default 0x1111…1111 |
| VITE_MOCK_OWNED_PARCELS | default 742,743,744 |
| VITE_CHAIN_ID | onchain network ID; mock defaults to 31337 |
| VITE_RPC_URL | public browser-accessible RPC |
| VITE_WORLD_PARCEL_NFT_ADDRESS | NFT deployment |
| VITE_PARCEL_STATE_ADDRESS | state contract bound to that NFT |

Old VITE_WORLD_RPC_URL, VITE_WORLD_ADDRESS and VITE_WORLD_CHAIN_ID aliases remain supported. Existing chain configuration implies onchain mode unless a mode is explicit. Without a state address, an old onchain configuration stays read-only. Startup validates RPC chain, NFT topology/generator, and state collection/schema. RPC/configuration failure never silently falls back to mock.

Deploy the existing DeployWorld script if needed, then `contracts/script/DeployParcelState.s.sol:DeployParcelState` with deployment variable `WORLD_PARCEL_NFT_ADDRESS`. Dry run with `forge script ... --root contracts --rpc-url YOUR_RPC` before deliberately broadcasting. No public deployment/transaction was made for this implementation. Contracts target Shanghai for compatibility with local Ganache as well as later EVMs.

The state contract is not upgradeable and NFT metadata is unchanged. Storage migration needs explicit state migration and runtime configuration. The configured state address is therefore part of deployment provenance alongside chain, NFT, seed and generator version. Runtime hosting/configuration is not itself immutable.

## Verification

`npm test` retains world tests and adds fixed-point conversion, local persistence, ownership, wallet lifecycle, limits, removal, terrain independence and streaming races. Foundry retains the NFT suite and tests state events, transfers, operator denial, bounds, cap, IDs and fuzz inputs. `npm run world:integration` requires forge and uses an ephemeral Ganache chain to verify viem reads/writes, reload, authorization, transfer, removal and event invalidation. No external RPC is used. Ganache's native µWS fallback warning on some Node versions does not prevent its JavaScript fallback from testing.

API references: [viem wallet clients](https://viem.sh/docs/clients/wallet), [simulateContract](https://viem.sh/docs/contract/simulateContract).
