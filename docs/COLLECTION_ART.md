# Atlas collection art, version 1

Seven original raster illustrations generated with the built-in image_gen tool. Full prompts are preserved in [ART_PROMPTS.json](ART_PROMPTS.json). Files live in `app/public/art/v1/`; the public gallery is `/art/`. The style uses faceted fantasy miniatures, dark green backgrounds, stone plinths and warm brass accents.

AtlasItems IDs 1–6 reference stone, wood, crystal, ancient-key, lantern and portal-core PNGs through their existing hosted metadata URLs. Names, IDs and gameplay semantics are unchanged. Old SVG fallback files remain available. These illustrations are collectible artwork, not replacement 3D meshes; the runtime still renders its existing procedural representations.

`character.png` is an explorer concept. **The deployed AtlasCharacters contract returns fixed JSON with no image and no setter.** Hosting an image cannot change that contract's tokenURI. Adding marketplace character art requires a separately approved replacement/migration design; no contract was redeployed or NFT moved for this art release. It is not represented as existing onchain character metadata.

To regenerate item JSON after an intentional art update: `node --experimental-strip-types scripts/generate-atlas-item-metadata.mjs`. Keep versioned artwork URLs so old artwork remains retrievable.
