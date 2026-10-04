# Exact wall art placement

Art placement resolves the persistent wall beneath the cursor, including hits on
its decorative child meshes. The wall's parcel and stable object ID determine
the storey; X/Z proximity no longer chooses the highest wall for new placements.

`DoodverseArtMounts` on Base:
`0xfc8Df48F0DEf23EFC233Fe25bfEa9356988aaD6a`.
Public build configuration includes `VITE_ART_MOUNTS_ADDRESS`; no additional
Vercel setting is needed when using `node scripts/build-atlas-base.mjs`.

The registry holds no tokens and grants no transfer rights. Existing ERC-721
and ERC-1155 custody remains unchanged. Only the current parcel owner can save
a mount, and the referenced solid wall must exist on that parcel. Writes include
an expected pose hash so a delayed confirmation cannot change a different placement.

Placement requires two confirmations: the existing attach/move transaction,
then the mount save. A rejected mount save leaves the NFT in custody. The asset
menu offers a mount-only retry and a discard option. After reloading, use
Reposition to choose and save a mount again. Neither path transfers an attached
NFT into custody twice.

Snapshots enrich both NFT standards with the saved wall ID. The world and parcel
showcase use the same rendering logic. A zero ID explicitly restores ground
placement. Removing the supporting wall restores the podium at the normal
support height rather than selecting another storey. Unmodified older art keeps
its previous automatic mounting until repositioned.

Records describe an asset at an exact parcel/X/Z/rotation pose; they are not an
attachment lifecycle log. An ERC-721 returned to precisely the same pose can
reuse the layout, and a new placement through this app explicitly saves its
chosen wall or ground state. ERC-1155 records are also keyed by their unique,
never-reused custody attachment ID. Parcel sales preserve anchors and transfer
mount editing rights to the new owner.

Deployment: `node --env-file=.env scripts/deploy-art-mounts.mjs` simulates;
`--broadcast` sends the bounded, journaled deployment. Verification uses
`scripts/verify-art-mounts.mjs` with `ETHERSCAN_API_KEY` and `FORGE_BIN`.
Public receipts and verification results are in `docs/deployments/`.
