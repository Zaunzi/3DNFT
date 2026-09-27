# CryptoDoodz item pages

| ERC-1155 item ID | Item | Canonical path | Retained alias |
|---|---|---|---|
| 1 | Afterhours DJ board | /items/1/ | /dj-board/ |
| 2 | Nocturne 88 keyboard | /items/2/ | /keyboard/ |
| 3 | Backbeat drum kit | /items/3/ | /drumkit/ |

Each path has a generated, self-contained `index.html` in `static/items/<id>/`. The existing SvelteKit static build copies these public files. Serve directory indexes on the public host; the preview redirects `/items/1`, `/items/2` and `/items/3` to their trailing-slash versions. All pages have navigation between items. The HTML itself requires no remote scripts or audio; collection navigation requires the three paths on the same host.

Build all players: `node scripts/build-items.mjs`. Individual build scripts still work and update both the canonical directory and old alias. Local preview: `node scripts/preview-dj-board.mjs`. Tests: `node --test tests/item-routes.test.mjs tests/keyboard.test.mjs`.

## Backbeat / item 3

Tap the drums/cymbals directly in 3D or the eight larger performance pads. Multiple pointers can trigger overlapping sounds. Keyboard A/S/D/F/G/H/J/K maps to kick/snare/high tom/mid tom/floor tom/hi-hat/crash/ride. Shift+H plays an open hi-hat; a closed hi-hat chokes its tail. Keyboard shortcuts work outside buttons and sliders; focused buttons can be played with Enter/Space. Background drag rotates the kit. Volume, mute, Stop sounds and Reset view are provided. The page stops sounds on losing focus. Original oscillator/noise synthesis approximates percussion; these are not sampled acoustic drums.

Desktop visual and interaction checks covered the model, all eight pads, and browser console errors. Automated tests verify canonical/alias route mapping, keyboard mappings and existing piano geometry. Real-phone multitouch and a live OpenSea embed are not yet verified.

## NFT metadata and publishing

Each source folder contains its numbered metadata template. No collection is deployed or minted by this change. Item 3 can be created in the same CryptoDoodzItems ERC-1155 contract with `createItem(3, chosenEditionCap, finalMetadataURI)` once the edition and public metadata are ready.

For public HTTPS hosting, set animation_url to `https://YOUR_PUBLIC_HOST/items/1/`, `/items/2/`, or `/items/3/` respectively. A local URL is not usable by OpenSea. Alternatively pin each self-contained HTML file and its image to IPFS and replace the template's CID placeholders. If pinning the entire site directory, include `items/<id>/index.html` in the animation_url path. Use Save cover in each player to export a 3000×3000 PNG for the image field. Public URLs and CIDs have not been assigned; do not publish the templates unchanged.

The Backbeat ZIP includes the player and metadata template. Export/pin its cover before minting. Public hosting, chain/owner selection, edition caps, minting, and world inventory integration remain separate steps. See CRYPTODOODZ_ITEMS.md for the contract workflow.
