# NFT attachments — Phase 4

An ERC-721 is identified by `NFTAsset = (chainId, contractAddress, tokenId)`. Keys normalize addresses and preserve token IDs as uint256-sized bigints. Runtime providers bind to a particular Doodverse land collection. Thus an attachment's compact parcel ID is interpreted in that provider's world; it is not a universal land identifier. Onchain records omit chain ID because custody exists only on the executing chain. Cross-chain custody and bridges are not implemented.

## Custody and authority

```text
Alice wallet -- approve(token) / attach --> WorldNFTState escrow
                                                |
                                      canonical location
                                                |
                                          Parcel #742
                                                |
                                      land transfers to Bob
                                                |
Bob wallet <------------- detach ---------------+

ERC721 -> WorldNFTState escrow -> Container #55 -> Parcel #742
ERC1155 -> ContainerItemState escrow -----------> Container #55
```

Invariants:

- Wallet-held NFTs have no Doodverse attachment. Registered NFTs are owned by WorldNFTState and have exactly one location.
- A location is either a parcel floor or one container in that parcel. A contained NFT is not also rendered on the floor.
- Land transfer preserves the complete attachment record, container, contents, existing objects, portals and ERC-1155 attachments. Only the current `land.ownerOf(parcel)` can move or withdraw assets. Approved land operators gain no edit rights.
- Moving between owned parcels, between floor and container, or between containers is one atomic location change. Escrow ownership does not change. Both source and destination require the caller to own the land.
- Detach deletes the location and transfers the NFT to the calling current controller. A failed receiver callback reverts everything. The depositor is provenance only; wallet inventory unrelated to the parcel remains untouched.

`WorldNFTState` uses non-reentrant entry points and a one-use expected-deposit hash. Only the ERC-721 contract, expected token/from address and expected operator can satisfy its receiver callback. Custody is checked after transfer; destination ownership is rechecked after the external callback. Malicious contracts cannot reenter a location mutation during transfers. These guarantees assume the external collection honors ERC-721 ownership/transfer semantics; an upgradeable or dishonest collection can violate its own ownership promises.

Doodverse land itself is rejected as an attachment: otherwise escrow could become the landowner of a parcel that recursively controls escrowed assets. Other external land collections are opaque NFTs; Doodverse does not infer their internal attachment rules. Containers are not NFTs and cannot be nested or transferred independently of their parcel.

## Container storage

Containers have globally increasing uint32 IDs, never array indices; IDs are not reused. Each contains 1–32 slots and is permanently associated with one parcel. A slot is either one ERC-721 or one nonzero AtlasItems type balance. Incrementing an existing item stack does not consume another slot. Removing a non-empty container reverts, regardless of whether its occupancy comes from ERC-721s or ERC-1155s. UI errors include the asset count in mock mode.

There are at most 32 containers, 32 doors and 64 ERC-721 attachments per parcel. Parcel reads return bounded snapshots. Containers only store control/location relationships. ERC-721s remain in WorldNFTState and ERC-1155s in ContainerItemState. The latter binds to the former and AtlasItems immutably; WorldNFTState's container-item address is set once at deployment. Capacity reservations, ledger updates and token movement revert atomically across contracts. Never bind an untrusted custody implementation.

X/Z use existing parcel-local centimeters, rotation hundredths of a degree. Floor assets/containers/doors use a conservative 150 cm footprint and bounds 150–6250. Container NFT coordinates must be exactly zero; visual position comes from the container. Y is derived from the unchanged terrain function. There is no vertical stacking or nested container recursion.

## Recovery

Direct unsolicited **safeTransferFrom** is rejected, preserving the sender's NFT. Use `attach` after per-token approval. ERC-721 **transferFrom** cannot be blocked by a receiver because it has no callback. Such an unregistered deposit can be recovered by the configured recovery authority after a publicly emitted seven-day schedule. The authority chooses the recipient using offchain evidence; the contract cannot infer the prior owner of an unsafe deposit. A schedule can be replaced, restarting its delay. Execution rechecks that the asset is unregistered. There is no rescue path for registered attachments, even for the authority. This is an explicit, limited trust surface, not permissionless proof of original ownership. Losing/renouncing recovery authority can leave unsafe deposits stranded.

## Metadata and representations

`tokenURI` supports HTTPS, IPFS resolved through `VITE_IPFS_GATEWAY`, base64 JSON and percent-encoded UTF-8 JSON. Names/descriptions/primitive traits are length-limited and inserted with `textContent` or canvas text. `animation_url` and other executable fields are discarded. Redirects, credentialed URLs, unsupported schemes, recursive data resources and IPFS dot segments are rejected. Fetches omit cookies/referrers, time out after eight seconds and stream at most 128 KiB of JSON. CORS/network/parse failures produce Unknown NFT.

Raster images are restricted to PNG and JPEG, with MIME/signature checks, bounded header dimensions (4096 per side, at most eight million pixels), a 4 MiB compressed limit and a 512×512 decoded texture. Static SVG images now support HTTPS/IPFS and bounded base64/UTF-8 data URLs, including fully onchain Lil Ghosts metadata. SVG is rebuilt from an allowlist of geometric elements and presentation attributes, then rasterized to a 512×512 texture. Scripts, event handlers, CSS, external references, embedded images, filters, animation, declarations and unsupported elements are rejected. SVG source is capped at 128 KiB, 2,048 elements and 24 nesting levels. HTML, WebP and other data-image resources still fall back. No external page, script or animation is embedded. Image failure leaves the pedestal intact. Browser decoding remains a browser trust boundary.

Metadata promises/results are cached by full asset identity (256 entries maximum), five minutes for success and 30 seconds for failures. The cache survives parcel streaming, not a reload. Images are owned by streamed entities; texture, bitmap, geometry and material resources are disposed on replacement/unload. Stale async results cannot resurrect unloaded parcels. Metadata is presentation only and never grants custody or access rights.

`NFTRepresentationRegistry` accepts custom `supports/createObject` renderers. The configured AtlasCharacters collection's token #1 gets a simple static geometric character. Other NFTs get a pedestal/card, optional safe image and text label. Mock fixtures use CryptoDoodz characters #1, #2, #77 and #12. There is no vehicle collection or vehicle deployment. AI, combat, equipment and specialized motion are deferred.

## Access requirements

Doors store `CHECK_ONLY` ERC-1155 minimum balance or exact ERC-721 ownership requirements. `canOpen` evaluates current wallet custody onchain; failures deny access. Escrowed NFTs do not count as wallet-held keys. The runtime performs the same provider query on E, opens the local door panel and permits passage. No keys are consumed. Open state is session-local and clears on wallet change/reload. Opening is not a secret-content boundary or an onchain proof of player position; a modified client can ignore visual collision. Any future economically meaningful gated action must call the requirement check in its own transaction.

`CONSUME` is deferred rather than pretending to consume atomically. Collection-wide discovery is not implemented: ERC-721 provides no universal wallet token enumeration. ERC-721 `balanceOf` could support a future any-token condition, but this phase deliberately implements exact-token requirements only. Pasted collection/token identity avoids mandatory wallet indexing.

## Mock workflow

Run `npm install`, `npm run dev`, visit `/?tokenId=742`, and Use mock owner.

1. Open **NFTs / Containers**. Select art #77 (or paste a known fixture identity). Approve, then Attach at the destination. Default coordinates are three units ahead.
2. Place a chest, select character #1, choose that chest in the destination selector, then Attach. To put a character on the floor instead, choose Parcel floor.
3. Refresh. Attachments and inventory remain. Approach within five units and E to inspect/open, or inspect from the asset panel.
4. Use **Transfer this parcel to Bob**, then **Use Bob**. Alice's modification controls disappear. Bob can inspect, move or detach the inherited assets. The inverse development transfer returns land to Alice.
5. Open a nearby chest to see wallet and stored item balances. Explicit approval/store/retrieve buttons handle ERC-1155s. Non-empty removal fails.
6. Place a door with item ID 4 and the mock item address prefilled. E without a key denies access. I → Key → DEV give → close → E opens it without consuming the key.

Mock mode stores NFT locations, container balances and item wallet balances within the existing single localStorage record. Web Locks serialize commits when supported; all writes either persist fully or report failure. Ownership overrides use a separate mock land record. Mock data/accounts are editable development fixtures, not security. Bob/Alice switches and grants are absent in onchain mode. Existing procedural and Phase 2 storage keys are preserved.

## Onchain configuration and deployment

Keep existing world and Phase 3 variables. Add:

| Variable | Meaning |
| --- | --- |
| VITE_WORLD_NFT_STATE_ADDRESS | NFT custody, containers and door state |
| VITE_CONTAINER_ITEM_STATE_ADDRESS | Separate ERC-1155 container escrow |
| VITE_ATLAS_CHARACTERS_ADDRESS | Optional known development collection |
| VITE_IPFS_GATEWAY | HTTPS gateway, default https://ipfs.io/ipfs/ |

Both custody addresses and AtlasItems are required together. Startup verifies immutable bindings and schema. Without Phase 4 deployment, existing systems remain available and the NFT panel explains configuration. Writes simulate, recheck wallet/chain, await receipts and render confirmed reads. Approve NFT uses `approve(escrow, tokenId)`, never implicit collection-wide approval. Container ERC-1155 approval is a separate explicit action. No private keys belong in VITE variables.

`DeployNFTState.s.sol` takes `WORLD_PARCEL_NFT_ADDRESS`, `ATLAS_ITEMS_ADDRESS`, `DEPLOYER_ADDRESS` (must match broadcaster) and `RECOVERY_AUTHORITY`. It deploys/binds the two custody contracts, hands recovery authority to the configured account and deploys owner-minted AtlasCharacters. Dry-run before deliberate broadcasting. This implementation has not been deployed publicly or audited.

## Tests and limits

`npm test`, `npm run world:check`, `forge test --root contracts`, and `npm run world:nfts:integration` cover identity, metadata fallback/cache, mock persistence/capacity, access, inheritance, streaming disposal, real custody, callbacks, receiver rejection, recovery and coordinate/movement/transfer fuzzing. `world:integration` retains the old integration and adds NFTs/containers on an ephemeral local chain.

Direct storage is intentionally bounded but costly on Ethereum L1; records, indexes, counters and logs add multiple writes per operation. Snapshot providers preserve a path to L2 or compressed state. Future commitments/event reconstruction must retain enforceable custody and data availability. ERC-721 attachments are separate from ERC-1155 items and portals. ERC-721 container NFTs, nested ownership, cross-chain movement, movable vehicles, marketplaces with content snapshots, and arbitrary external runtime execution remain out of scope.

Receiver semantics follow the [OpenZeppelin ERC-721 interfaces](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721).

### Verified implementation

The final runtime suite passes 23 tests; Foundry passes 26 tests, including 256-run attachment-coordinate and movement/transfer fuzz cases. Both local-chain integration scripts pass. Doodverse and legacy production builds pass; 54 legacy tests pass. On this host Node is 22.12, so legacy tests required `node --experimental-strip-types --test tests/*.test.mjs`; the documented supported Node 22.14+/24 environment enables that behavior by default. Vite reports the existing large-runtime-chunk advisory; the Doodverse entry is approximately 213 KiB gzip.

Browser checks exercised floor attachment, NFT container storage, refresh persistence, non-empty deletion rejection, Alice-to-Bob inheritance, Bob withdrawal, and key denial/grant without consumption. Temporary NFT/chest/door test placements were removed and parcel #742 plus its four development NFTs returned to Alice. A development key remains in Bob's unrelated wallet, demonstrating that land transfer does not move wallet inventory.

## Place Doodverse Characters

Open **Inventory → Place Doodverse Characters**, or **Characters / NFTs / Containers**. Connect the wallet that owns your character and parcel. Enter the minted character token ID (1–1000), choose **Select my character**, then **Approve character** and **Place character near me**. Approval is per token. Placement uses the existing DoodverseNFTState escrow and positions the character three meters ahead, grounded on terrain. Near parcel edges, move inward before placing. Use E to inspect a placed character, move/store it or detach it into the current parcel owner's wallet. Attached characters remain with the land after sale. No new contracts are required.

The picker verifies ownerOf for the entered ID; it does not scan the wallet or assume ERC721Enumerable support. Mock mode supplies characters 1, 2, 12 and 77. The native renderer loads only the known CryptoDoodz GLB path for IDs 1–1000, never arbitrary metadata animation URLs. Models are static, normalized to human scale, cached as bounded source bytes and instantiated with independently disposable GPU resources. External-resource GLBs, oversized responses and failed loads fall back to the existing NFT representation. Existing external NFTs retain safe image rendering. Characters are visible in neighboring parcels and the NFT showcase. They do not move or have AI in this release.
