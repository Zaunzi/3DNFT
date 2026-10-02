# Doodverse-hosted collections

The Doodverse Vite build serves all new collection resources from `app/public` at `https://atlas-mu-lime.vercel.app/`. The legacy SvelteKit site and its 1,000-character files are preserved for previously minted tokens. No Vercel configuration file or new backend is required.

## CryptoDoodz / Doodverse Characters

The expanded collection has 5,000 deterministic, unique appearances (background excluded from uniqueness), IDs 1Ã¢â‚¬â€œ5000. It uses the existing r10 trait donors, their 16-bone rig, and six animation clips. The fixed recipe seed preserves the first 1,000 recipes and extends the sequence to 5,000. There are 152 catalog options; compatibility constraints remain in the planner.

Paths, with four-digit padding:

- `/cryptodoodz/metadata/0001.json`
- `/cryptodoodz/images/0001.png`
- `/cryptodoodz/models/0001.glb`
- `/cryptodoodz/interactive/0001.html`

Metadata image, animation and model links all use the Doodverse host. Interactive pages retain Idle, Walk, Run, Jump, Shoot and Wave controls. No model is loaded until its preview or world entity is needed.

`DoodverseCharacters` now exposes free public `mint(quantity)`, `mintedBy(wallet)` and `totalSupply`. Quantity is 1Ã¢â‚¬â€œ5, each wallet may mint five for life, and IDs are assigned sequentially from 1. Supply is capped at 5,000. Transfers and attachment do not restore allowance; contract owners have no mint bypass. A reentrancy guard and precommitted counters protect receiver callbacks. A rejected callback rolls back the entire batch. Multiple wallets per person cannot be prevented by a wallet counter.

## Trinkets

`/trinkets/metadata/1.json` through `5.json` reference this host's artwork, playable instrument HTML and GLB models. The existing authored instruments remain playable without navigating to the legacy site. The public-mint contract uses the new metadata base, with one lifetime claim per instrument per wallet.

## Reproduce

Use a new output folder so an existing release is not overwritten:

```sh
python scripts/cryptodoodz/plan_expanded_collection.py outputs/cryptodoodz-collection-r10 outputs/cryptodoodz-5000 5000
python scripts/cryptodoodz/produce_1000.py outputs/cryptodoodz-collection-r10 outputs/cryptodoodz-5000 outputs/cryptodoodz-5000
python scripts/cryptodoodz/verify.py outputs/cryptodoodz-5000
python scripts/cryptodoodz/audit_clothing.py outputs/cryptodoodz-5000
python scripts/cryptodoodz/publish_parallel.py outputs/cryptodoodz-5000 app/public/cryptodoodz
node scripts/cryptodoodz/build_interactive_release.mjs . outputs/cryptodoodz-5000 --doodverse
node scripts/generate-trinket-metadata.mjs
```

Preview rendering requires NumPy and Pillow. Validation checks every generated model's geometry, weights, joints, six moving clips and loop endpoints; it does not claim human inspection of every combination. Rendering runs in four local worker processes. Generation is performed ahead of deployment; Vercel only builds and copies static files with the existing `node scripts/build-atlas-base.mjs` command and `app/dist` output.

## Trait geometry repair (r11)

The forked beard now has a connected jaw and split chin silhouette. Both it and
the mutton chops wrap around the cheek corners. Thirty long-sleeved outfits have
slightly longer existing upper and lower sleeves to cover the exposed elbow gap.
No extra elbow meshes or joint pieces are added. Short sleeves,
rolled sleeves, hands, token IDs, trait selections and animation clips are unchanged.
This affects 3,319 of the 5,000 characters. The legacy site's assets remain separate.

To reproduce the repair from the original donors and existing recipes:

```sh
blender -b --python scripts/cryptodoodz/repair_r11.py -- outputs/cryptodoodz-collection-r11 outputs/cryptodoodz-collection-r10
python scripts/cryptodoodz/plan_trait_repair.py outputs/cryptodoodz-collection-r11 outputs/cryptodoodz-5000 outputs/cryptodoodz-5000-r11
python scripts/cryptodoodz/produce_1000.py outputs/cryptodoodz-collection-r11 outputs/cryptodoodz-5000-r11 outputs/cryptodoodz-5000-r11
python scripts/cryptodoodz/audit_sleeve_repair.py outputs/cryptodoodz-collection-r10 outputs/cryptodoodz-collection-r11
python scripts/cryptodoodz/verify.py outputs/cryptodoodz-5000-r11
blender -b --python scripts/cryptodoodz/review_r11.py -- outputs/cryptodoodz-5000-r11
python scripts/cryptodoodz/publish_parallel.py outputs/cryptodoodz-5000-r11 app/public/cryptodoodz
node scripts/cryptodoodz/build_interactive_release.mjs . outputs/cryptodoodz-5000 --doodverse
python scripts/cryptodoodz/finalize_trait_repair.py outputs/cryptodoodz-5000 outputs/cryptodoodz-5000-r11 app/public/cryptodoodz
```

The final interactive-page step uses the **full original recipe list**, retaining
the 5,000-entry release. Review renders reimport production GLBs, including Wave
and Shoot poses, rather than relying on Blender source geometry alone.

## Deployment boundary

Existing Base contracts have fixed metadata URLs and mint rules. Updating source or the website cannot change those deployed contracts. Public character mint remains disabled against the old contract until a replacement is deployed and configured. Trinkets also need a matching replacement escrow. Preserve legacy collection access/withdrawal when planning that transition. This release does not send blockchain transactions or alter deployed addresses.
