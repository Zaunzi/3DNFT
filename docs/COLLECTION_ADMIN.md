# Owner-only collection controls

These functions are implemented in the contract sources for the **next deployment**.
They do not modify already-deployed, non-upgradeable Base contracts. Constructor
arguments and existing mint selectors are unchanged. No transactions are sent by
this source update, and deployed addresses remain unchanged.

## Mint pause

All Doodverse token collections expose:

```solidity
function mintPaused() external view returns (bool);
function setMintPaused(bool paused) external; // onlyOwner
```

Call `setMintPaused(true)` to stop new issuance and `setMintPaused(false)` to resume.
New contracts start unpaused, preserving current deployment behavior. The contract
owner cannot bypass the pause. Pausing does not consume allowances or assign IDs;
resuming keeps the same supply, sequential IDs, and lifetime wallet limits.

This covers Parcels, Characters, Trinkets (both mint overloads), Parcel Items and
Keys. For Keys it stops both initial key creation and issuing copies. Creating a
keyed door or rekeying while paused reverts the entire operation; it cannot leave
a partial door or revoke a key without creating its replacement. Existing keys,
revocation, door removal, token transfers, parcel sales, and escrow withdrawals
continue working. Parcel-transfer key expiration rules are unchanged.

`PUBLIC_MINT` still describes whether public minting is supported, not whether it
is currently paused. Clients should inspect `mintPaused()` and simulate transactions.
Older deployments without that getter must be handled as older contracts.

## Metadata setters

| Collection | Owner function | Result |
| --- | --- | --- |
| Doodverse Parcels | `setMetadataBaseURI("ipfs://CID/parcels/")` | `<base><decimal tokenId>.json`, starting at `0.json` |
| Doodverse Characters | `setMetadataBaseURI("https://host/cryptodoodz/metadata/")` | Four-digit IDs, e.g. `0001.json` through `5000.json` |
| Doodverse Trinkets | `setMetadataBaseURI("https://host/trinkets/metadata/")` | `1.json` through `5.json` |
| Doodverse Parcel Items | `setURI("ipfs://CID/items/{id}.json")` | Standard ERC-1155 URI/template |
| Doodverse Keys | `setURI("ipfs://CID/keys/{id}.json")` | Standard ERC-1155 URI/template |

Base prefixes must end in `/`. ERC-1155 templates use the standard client-side
`{id}` replacement: 64 lowercase hexadecimal digits without `0x`, not decimal
filenames. A full JSON data URI or common metadata URL also works for Items/Keys.
Empty values are rejected, except on Parcels where an empty base explicitly
restores the existing generated onchain JSON and SVG fallback.

Parcels also expose `setRuntimeURL("https://new-host.example/")`. This changes the
`animation_url` inside generated metadata. It preserves the existing HTTPS,
trailing-slash and JSON-safe URL validation. When a metadata base override is set,
that external JSON controls its own image and animation URLs; the runtime setter
only affects the generated fallback. Neither setter changes terrain seed,
coordinates, generator version, ownership epochs, or attached world state.

Updates apply to already-minted tokens and future mints. They change metadata
references, not uploaded files: publish the new assets before switching URLs.
There is deliberately no irreversible metadata freeze in these Doodverse controls.
Transferring contract ownership transfers administration; renouncing ownership
permanently removes the ability to pause/resume or update metadata.

## Events and compatibility

- `MintPausedChanged(bool)` records issuance state changes.
- `MetadataURIUpdated(string)` records every metadata URL/template update.
- ERC-721 collections advertise ERC-4906 and emit `BatchMetadataUpdate`.
- Trinkets and Parcel Items also emit standard `URI` events for their finite IDs.
- Keys emit the global metadata update event rather than looping through an
  unbounded number of key IDs. Indexers can refresh affected key metadata from it.
- Parcels emit `RuntimeURLUpdated(string)` and a metadata refresh event.

The compatible Atlas token source contracts under `contracts/src` also receive
these controls: AtlasItems shares implementation with DoodverseItems;
WorldParcelNFT has the same parcel setters; AtlasCharacters has `setURI` for its
shared metadata document. Existing deployed Atlas contracts remain untouched.
The separate legacy Cloudacre/CryptoDoodz contracts under `contracts/` are not part
of the Doodverse suite and are unchanged.

World-state, portal, and custody contracts neither mint collections nor provide
token metadata, so no meaningless setters or transfer pauses were added to them.

## Verification

`forge test --root contracts` covers authorization (including fuzzing), ownership
handoff, pause/resume, all mint entry points, unchanged allowances, transfer and
escrow availability, atomic key/door rollback, metadata formatting, URL validation,
events and compatibility contracts, alongside the existing world tests.
