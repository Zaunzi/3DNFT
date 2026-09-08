# Seasonal oil economy (OilField v2)

The oil pivot is a new NFT collection and new OIL resource contract. The existing deployed Cloudacre/SEED contracts and the receipt at deployments/base-sepolia.json are preserved. The old contract is not upgradeable; do not use its address as VITE_OIL_FIELD_ADDRESS.

## Default prototype rules

| Parcel | Fixed supply | Seasonal OIL range | Mean allocation |
|---|---:|---:|---:|
| Small | 500 | 1,000–2,000 | 1,500 |
| Medium | 300 | 2,500–5,000 | 3,750 |
| Large | 200 | 6,000–10,000 | 8,000 |

Sizes are immutable. Every parcel gets one survey per global 7-day season. The first season starts at OilField deployment. Each survey requests an independent Pyth Entropy result, mapped to a whole-number allocation in the size's inclusive range. The modulo bias of reducing a 256-bit value into these small ranges is negligible, not mathematically zero.

If every parcel is minted and surveyed, the maximum possible allocation is 4,500,000 OIL per season; the expected allocation under uniform randomness is 3,475,000 OIL. Unminted and unsurveyed parcels issue nothing. These are bounds on allocation for a season, not on the amount claimed in a particular calendar period: players can claim multiple old seasons at once. Total lifetime supply remains uncapped across seasons. Pyth randomness does not by itself create demand, sustainable token value, or a balanced economy.

A base-level reserve unlocks linearly from the global season start until its end. Equipment upgrades accelerate the remaining extraction. Claiming more frequently does not increase lifetime extraction. A late survey or callback can immediately unlock the elapsed part of its season. A parcel minted late in a season can still survey for the full seasonal allocation; production mint economics should account for this. There is no claim-storage penalty, no expiring claim, and no upgrade that multiplies the reserve. Harvested OIL is a transferable ERC-20 game resource, not physical oil, a redeemable commodity, or a price peg. Equipment upgrades burn OIL; ongoing sinks after maximum equipment level remain future economy work.

The test faucet permits one free parcel per wallet, with per-size supply caps. This is not a production sale or Sybil defense. There is no reason for a test player to prefer free small land over available free large land except testing. Set a deliberate pricing/distribution policy before any real-value release.

## Pyth integration

Sources checked September 7, 2026:
- https://docs.pyth.network/entropy/generate-random-numbers-evm
- https://docs.pyth.network/entropy/request-callback-variants
- https://docs.pyth.network/entropy/debug-callback-failures
- https://docs.pyth.network/entropy/chainlist

SDK: @pythnetwork/entropy-sdk-solidity 2.2.1. OilField inherits IEntropyConsumer and calls IEntropyV2.requestV2(provider, userRandomNumber, gasLimit). The browser contributes 32 random bytes; Pyth combines this with provider entropy. The provider is pinned at deployment using getDefaultProvider. The fee is read onchain using getFeeV2(provider, 200000); no fixed ETH fee is assumed. A stale fee causes the survey to revert so the wallet can re-quote. Exact fees are forwarded; no refund callback or trapped excess is required.

A survey stores a provider-scoped sequence reference to its parcel and original season. The SDK's external wrapper authenticates the Entropy contract. Internal callbacks ignore unknown sequences, wrong providers, and duplicate fulfillments without changing a reserve. The callback performs bounded storage updates, makes no external calls, and has a requested 200,000-gas limit. Local tests cover the callback below that budget, but a real Pyth reveal has not been tested against this new deployment.

Transfers do not reset surveys, change parcel size, or reroll allocations. The current NFT owner inherits unharvested reserves from all seasons. Already harvested OIL stays in the previous owner's wallet. Approved NFT operators cannot survey or harvest. Account ownership is checked again in the contract at execution.

A delayed callback stays assigned to the original season even if a new season has begun. There is deliberately no timeout reroll, owner-selected fallback randomness, or cancellation. Provider/reveal failures require diagnosing and completing the original Pyth request, using Entropy Explorer and the official callback debugging guide. These immutable contracts cannot patch a consumer bug after deployment. Provider outages may delay reserves; old fulfilled reserves remain claimable.

## Deployment

1. Keep your original farm configuration unchanged.
2. Verify the current **Base Sepolia** Entropy address in the official Pyth chainlist; never use a Pyth price-feed address instead.
3. Set DEPLOY_RPC_URL, DEPLOY_PRIVATE_KEY, PUBLIC_SITE_ORIGIN and PYTH_ENTROPY_ADDRESS only in the deployment process environment. Do not prefix private keys with VITE_. The script reads process environment, not .env automatically.
4. Run pnpm oil:deploy. It refuses chains other than Base Sepolia, verifies code exists at the Entropy address, and reads the provider and fee API before deployment. It cannot prove that a supplied contract is the official Pyth deployment; verify provenance yourself.
5. Set VITE_OIL_FIELD_ADDRESS to the new oilField address from deployments/oil-base-sepolia-TIMESTAMP.json. Rebuild and deploy the SvelteKit app.
6. On /oil/nft/, mint a parcel, select the current season, and survey. Pay the displayed native-token fee and gas. Wait for the separate Pyth callback; a mined survey transaction is not a revealed allocation.
7. After revelation, harvest unlocked OIL. Use the season selector to claim older reserves.

The deployment script never overwrites the old receipt and does not migrate or burn old NFTs/tokens. This change has not deployed new contracts. Public token metadata requires a public HTTPS site origin serving /oil/nft/ and /oil/embed/. A private Sites preview cannot be used by OpenSea. Keep the chosen public origin stable; it is fixed at construction.

## Demo and routes

- / is the oil demo. Three independent local parcels; 5-minute accelerated seasons; browser crypto randomness explicitly labelled simulation. The demo begins one minute into its first season so surveying can unlock a sample harvest immediately.
- /oil/nft/?token=1 is the wallet-enabled OilField v2 page.
- /oil/embed/?token=1 is its read-only 3D viewer. No wallet is initialized.
- /farm/ is the preserved SEED demo, using its original save key.
- /nft/ and /embed/ retain their original meanings for deployed SEED land metadata.

The oil save key is cloudacre-oil-demo-v1. It cannot authorize blockchain rewards. Old demo data is not converted or deleted.

## Validation

Tests cover size bounds, dynamic fees, expected-season protection, duplicate requests, forged/provider-mismatched/duplicate callbacks, delayed callbacks across rollover, allocation caps, fractional unlocking, historical claims, owner transfers, operator restrictions, metadata, and demo accounting. Existing farm tests remain. Real Entropy callbacks, public-chain wallet transactions for OilField, and OpenSea rendering still require deployment validation. This is unaudited testnet code.


## Equipment upgrades and district

Owners can burn OIL for three permanent equipment levels. Next upgrade costs are 250 / 1,000 / 2,250 OIL for Small, 500 / 2,000 / 4,500 for Medium, and 750 / 3,000 / 6,750 for Large. Rates are 1x, 1.25x, 1.5x and 1.75x. Upgrade spending is field-authorized and owner-only; no ERC20 allowance is needed. These are prototype balance parameters, not an established sustainable economy.

Each survey records extraction progress in quarter-seconds. An upgrade checkpoints the current season, including pending surveys, before changing its rate. Earlier time is never repriced. Historical reserves finish unlocking and stay claimable; the total reserve never grows. Future surveys use the permanent level. Equipment transfers with the parcel. Late surveys retain the existing global-season catch-up rule.

The `/oil/world/` district is an explorable local simulation with six clickable example plots. It does not represent live ownership locations or multiplayer sessions. All Three.js coordinates use one metre per unit, with 24 x 18.48 m, 41.57 x 32.01 m, and 58.79 x 45.27 m parcels (1:3:6 land area). The individual viewer uses the same models and a fixed camera across sizes. Equipment has additional visible modules at each upgrade. Roads are 12 m wide, pavements 3 m wide, and a 1.8 m mannequin gives a human reference. Cell spacing is 76 m. Future avatars can use metre-based movement/collision dimensions; networking, collision navigation, ownership coordinates and multiplayer persistence remain future work.
