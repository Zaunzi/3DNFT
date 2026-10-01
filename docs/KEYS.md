# Doodverse lock keys

`DoodverseKeys` is a separate ERC-1155 collection. Parcel Item #4 is the older shared utility key; it does not unlock new distinct-key doors. New toolbar doors atomically create a fresh key ID and issue one copy to the current parcel owner.

- Each lock gets a monotonically increasing key ID. Owning one ID grants no access to another lock.
- The current parcel owner can issue 1–100 copies per transaction to another wallet. Only the parcel owner can issue copies, even if a guest holds a key.
- **NFTs / Containers → door → Issue key copy** gives a guest one copy. **Rekey this door** revokes the old ID and creates a new one. Removal revokes the key as well.
- The current parcel owner can always operate these doors, including immediately after buying the land. Rekeying issues the buyer a new token for guest distribution.
- DoodverseParcels increments an ownership epoch whenever ownership changes. Keys bind to their issue-time epoch; a sale invalidates all earlier copies, including when land later returns to a prior owner. A self-transfer does not change ownership.
- Revoked/expired key tokens remain in wallets as historical tokens and can still be transferred; they no longer grant access. They are not silently burned.
- Existing arbitrary ERC-1155/ERC-721 access requirements remain available in the advanced panel and do not acquire these new epoch rules. Use the build toolbar for distinct-key locks.

The NFT-state contract and key contract are bound once during deployment. Key creation/rekeying and receiver callbacks are atomic. Callback failures, ownership changes during callbacks and invalid placements revert the operation. The key contract has no administrative bypass to create keys outside the bound door controller. Copies remain CHECK_ONLY and are not consumed on entry.

Mock mode persists separate key balances and lock IDs in the existing browser ledger, with ownership epochs alongside the ownership records. No utility inventory or attached asset is migrated.

Doors are client-side gameplay boundaries. Onchain asset custody permissions protect valuables independently of the door's visual state; locks do not make public blockchain data private. World-state reconciliation closes previously opened doors so access is checked again.
