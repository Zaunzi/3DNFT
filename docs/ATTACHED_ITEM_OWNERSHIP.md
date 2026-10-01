# Attached item ownership

## Parcel transfer invariant

For every transfer of parcel #742 from Alice to Bob:

- Alice loses permission to modify #742; Bob gains it.
- Persistent objects (including future buildings), portals, and attached ERC-1155 instances remain unchanged.
- Alice cannot withdraw attached items; Bob may collect them into Bob's wallet.
- Alice's unrelated wallet inventory, including unattached quantities of the same item type, is unaffected.
- Original depositor addresses remain provenance only.

`WalletItem` represents a queried wallet's liquid ERC-1155 balance. `AttachedWorldItem` represents a stable instance attached to a parcel and backed by escrow. These are separate types and provider APIs, not one object with optional coordinates.

```text
Alice wallet --attach--> Parcel #742 / escrow
                              |
                        land transfers
                              v
                        Bob controls #742 --collect--> Bob wallet
```

## Custody invariant

Each quantity is held in a wallet OR held in world escrow and associated with a parcel, never both. ERC-1155 units are fungible: one wallet can retain seven units while twelve other units of the same type are attached.

For each item type, `escrowed[itemType]` equals the sum of quantities in active attachments and the WorldItemState contract's ERC-1155 balance. Attachment atomically debits the wallet and creates the escrow-backed record. Collection atomically deletes the record and transfers that quantity to the current parcel owner. Failed transfers revert the entire operation; collecting an instance twice fails. Transferring land changes authority, not any item balance or attachment record.

The mock implements the equivalent accounting in a single storage commit. `app/test/attached-items.test.ts` and `contracts/world-test/AttachedItems.t.sol` cover transfer permissions, retained objects and portals, depositor history, unrelated wallet balances, and rejection of duplicate collection. The Foundry test fuzzes attached quantities and both collection entry points. Buildings currently use generic persistent objects; a dedicated building system is not implemented.

## ERC-721 attachments

Phase 4 implements ERC-721 attachments in a separate WorldNFTState contract, with unique identity `(chainId, contractAddress, tokenId)`, escrow custody, guarded receiver callbacks, current parcel-owner withdrawal, and conservation tests. One-level containers can hold NFTs and ERC-1155 stacks. Doodverse land attachment is prohibited to avoid ownership cycles. WorldItemState remains the ERC-1155 floor-item contract and exposes no ERC-721 deposit endpoint. See [NFT attachments](NFT_ATTACHMENTS.md) for the recovery model, metadata restrictions and container rules.

## Sale behavior

Transferring a parcel transfers the claim to every item still attached to that parcel. This applies to sales, gifts, and other ERC-721 transfers. The seller can withdraw items before transferring the land; items left attached belong to the buyer.

Attached ERC-1155 tokens remain in WorldItemState escrow and remain visible in the world. They are not automatically moved into the buyer's wallet during the land transfer. Only the current `ownerOf(tokenId)` may collect or clear them, and collection transfers them to that owner. The original depositor is recorded solely as provenance and retains no withdrawal rights after transferring the parcel.

Mock state uses the same ownership rule. Inventory items that were never attached to a parcel remain in their wallet. Placed decorations and portals also remain associated with their parcel, with editing authority following its current owner.

This prevents a previous landowner from reclaiming attached items after the buyer receives the land. It does not lock the parcel's contents while a marketplace listing is pending; snapshot-based sale guarantees would require a separate sale mechanism.
