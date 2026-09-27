# Items and portals

`AtlasItems` is an owner-minted ERC-1155 registry: Stone (1), Wood (2), Crystal (3), Key (4), Lantern (5), Portal Core (6). There is no public mint faucet. Mock inventory has an explicitly labeled development grant button. Types 1–3 stack up to 1,000,000 per world instance; types 4–6 have single-unit instances.

`WalletItem` is a wallet balance; `AttachedWorldItem` is an escrow-backed instance. `WorldItemState.placeItem` atomically transfers wallet units to escrow and creates a stable, per-parcel instance. Collection deletes that instance and returns its quantity to the current parcel owner. Selling land leaves items attached and changes collection authority. Depositor is provenance only. See [ownership invariants](ATTACHED_ITEM_OWNERSHIP.md).

```text
Wallet balance -> WorldItemState escrow -> AttachedWorldItem -> Parcel
                                                           -> current landowner
```

`PortalState` stores stable internal destinations and validates that destination parcels exist. Portals do not consume Portal Cores. E travels within the existing scene, changing the URL, parcel, streamed neighborhood and safe spawn; Return through portal uses a session-only stack. Spawn candidates avoid procedural vegetation, persistent objects, items, portals, NFTs, containers and doors. Unsupported external destinations fail without navigating. Cross-collection portal identities are reserved types, not active navigation.

The `ExperienceStore` abstraction separates inventory, placement and portal APIs from rendering. Mock mode persists inventory and attached state in one versioned localStorage record, using Web Locks where supported. Onchain mode uses viem simulation, wallet/chain rechecking and confirmed receipts. Inventory uses batch balances; world reads are bounded parcel snapshots. No per-frame RPC, indexer, session or database is required.

I opens inventory; choose quantity and Drop to attach three units ahead on owned land. E collects a focused item within five units. Use toggles a held Lantern's local light. B enters building; 6 chooses a portal and exposes a destination field. All placement coordinates use the existing parcel-local centimeters, rotation in hundredths of degrees, and terrain-derived Y. Range and ownership are rechecked by contracts; physical proximity is a runtime constraint, not an onchain proof of player position.

Configure `VITE_ATLAS_ITEMS_ADDRESS`, `VITE_WORLD_ITEM_STATE_ADDRESS` and `VITE_PORTAL_STATE_ADDRESS` together in onchain mode. With none set, existing parcel exploration/building continues and item features are disabled. A partially configured deployment fails validation. Schemas and immutable bindings are checked at startup. Writes and refresh/focus/periodic reconciliation update streamed neighbors; no live event indexer is needed for these modules.

Direct L1 storage and per-action transactions are intentionally a prototype. WorldItemState holds at most 64 instances per parcel, PortalState at most 16 portals. Item instances occupy two slots plus array/counter/accounting overhead. Future providers can use L2, event replay, compressed snapshots or state commitments while preserving custody and controller rules. IPFS/blobs alone cannot enforce withdrawals without an onchain verification design.

Phase 4 adds separate `ContainerItemState` custody for ERC-1155 container stacks. It does not duplicate or migrate WorldItemState records. To move a floor item into a chest, collect to wallet then store; those are two explicit transactions. NFT location moves, in contrast, are atomic within WorldNFTState.
