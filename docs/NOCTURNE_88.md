# Nocturne 88 — CryptoDoodz item 002

The second item is a playable 88-key keyboard: A0 to C8, 52 white and 36 black keys. It uses the existing CryptoDoodzItems ERC-1155 contract design; no separate contract is needed. All copies of item 2 share the same player. Not deployed, minted, or integrated into the CryptoDoodz world inventory.

## Play

Open `static/keyboard/index.html` directly, or run `node scripts/preview-dj-board.mjs` and visit http://127.0.0.1:3000/keyboard/. The same preview serves the DJ board at /dj-board/.

Touch or click the 3D keys, or use the larger keyboard below. Octave jump buttons and the horizontal scrollbar reach all 88 notes. Multiple pointers play chords; sliding across keys plays a glissando. A W S E D F T G Y H U J K play one chromatic octave starting at C4; Z/X change typing octave. Typing shortcuts work when focus is outside form controls. Individual piano buttons support Enter/Space. Space holds sustain when focus is outside buttons and inputs. Sustain also has a latch button. All notes off releases voices; loss of page focus stops notes.

Three synthesized timbres are included: soft piano, electric keys and warm organ. They are original oscillator-based approximations, not sampled acoustic instruments. Maximum 40 concurrent synthesized notes, with oldest-voice stealing. No external audio files, CDN, wallet or RPC required. Three.js MIT notices remain in the bundle.

## Build and validation

- `node scripts/build-keyboard.mjs`
- `node --test tests/keyboard.test.mjs`

Automated checks verify 88 unique notes, 52/36 white/black key counts, endpoints, tuning and black-key placement. Desktop browser checks covered rendering, note input including A0/C8, voice selection, sustain and stop without console errors. Real-device multitouch and OpenSea embedding remain unverified.

## NFT media

The media package contains self-contained `index.html` and `2.metadata.template.json`. Use Save cover in the player to download a 3000×3000 `cryptodoodz-nocturne88.png`; automatic download retrieval was unavailable during packaging, so the PNG is not included. Pin the HTML and exported PNG to a public IPFS directory (or stable public hosting), replace the placeholder media URLs in the metadata, then pin the final JSON. Do not publish placeholder metadata. Item 002 uses a different media directory from item 001.

After collection deployment and deciding the edition size, the owner can call `createItem(2, chosenCap, finalMetadataURI)`, then `mint(recipient, 2, quantity, "0x")`. The item cap is immutable. Verify the live embed before freezing metadata. Chain, owner, edition cap and mint distribution are not chosen here. See `docs/CRYPTODOODZ_ITEMS.md` for the collection contract workflow.


Canonical collection URLs are now /items/1/, /items/2/ and /items/3/. Original named paths remain aliases. See docs/ITEM_PAGES.md for builds and hosting.
