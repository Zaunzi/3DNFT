# CryptoDoodz Items: Afterhours DJ Board

Item type 1 is the first proposed item in a separate ERC-1155 CryptoDoodz Items collection. It does not modify or replace the existing CryptoDoodz ERC-721 characters. All copies of item 1 share the same art and controls. No wallet is needed to play; owning an item does not yet equip it in the CryptoDoodz world.

## Play and build

- Open `static/dj-board/index.html` directly, or run `node scripts/preview-dj-board.mjs` and visit http://127.0.0.1:3000/dj-board/.
- Rebuild after editing `dj-board/main.js` or `dj-board/template.html`: `node scripts/build-dj-board.mjs`.
- The approximately 530 KB HTML includes Three.js, geometry, controls and synthesized audio. No CDN, external samples, wallet extensions or RPC required. Three.js is MIT licensed; bundled license notices are retained.
- Enable audio, start either deck, use pads, filters, levels, shared tempo and the crossfader. Drag a platter for a synthesized scratch effect (not sample-accurate record scratching). Drag the background to rotate. Keyboard: Space and 1–8.
- Save cover exports a 3000×3000 PNG rendered from the board. Browser audio requires a gesture; returning from another page requires enabling audio again.

## ERC-1155 contract

`contracts/CryptoDoodzItems.sol` uses OpenZeppelin ERC1155Supply and two-step ownership. The owner creates item IDs with immutable supply caps and explicit per-item metadata URLs, then distributes quantities through owner-only minting. ERC-1155 transfers and batch transfers are available. Item URIs can be updated until the owner permanently freezes each item. Standard URI events announce updates. There is no paid/public mint, automatic holder claim, royalty setting, burning, or game inventory integration.

Build: `node scripts/compile-items.mjs`. Test locally: `node --test tests/items.test.mjs`.

The collection is not deployed. Chain, owner wallet, edition quantities and distribution rules have not been chosen. The test's quantities are fixtures, not collection decisions. Contract tests are not a security audit.

## Publish as an OpenSea item

1. In the player, Save cover to obtain `cryptodoodz-afterhours.png`.
2. Pin that PNG and the self-contained `static/dj-board/index.html` to durable public hosting (for example an IPFS directory). Retain/pin the files; a local preview is not public NFT hosting.
3. Copy `dj-board/1.metadata.template.json`; replace both placeholder media CIDs with the real directory CID. Pin the resulting JSON. Do not publish the template unchanged.
4. Deploy CryptoDoodzItems on the chosen supported chain with the chosen owner. Call `createItem(1, editionCap, metadataURI)`, then `mint(recipient, 1, quantity, "0x")` from the owner wallet. No onchain transaction has been performed by this work.
5. Verify the minted token on OpenSea and test its embedded audio and touch behavior on desktop and a real phone before freezing metadata. Publish later equipment under new item IDs.

The contract returns an explicit URI per ID, so JSON filenames need not follow ERC-1155's 64-character hexadecimal `{id}` substitution convention.

OpenSea supports HTML with scripts and relative paths through `animation_url`: https://docs.opensea.io/docs/media-and-traits. A GLB alone cannot carry these JavaScript/audio interactions. Real-device touch and a live OpenSea embed still require validation.


Canonical collection URLs are now /items/1/, /items/2/ and /items/3/. Original named paths remain aliases. See docs/ITEM_PAGES.md for builds and hosting.
