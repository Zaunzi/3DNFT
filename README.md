Current oil release adds OIL-burning equipment upgrades and an explorable district at `/oil/world/`. Small/medium/large use consistent metre dimensions and a 1:3:6 area ratio. The district is a local simulation prepared for future avatar scaling; live multiplayer is not included. See [oil economy](docs/OIL_ECONOMY.md) for rates, costs and deployment requirements.

# Cloudacre Oil — seasonal oil parcels

The current homepage is the new SvelteKit + Three.js oilfield. Small, medium, and large NFT parcels receive finite seasonal reserves through Pyth Entropy. See [Oil economy and deployment](docs/OIL_ECONOMY.md) for rules, limitations, routes, and setup.

Run `pnpm contracts:compile`, `pnpm test`, `pnpm check`, and `pnpm build`. Deploy the new contracts with `pnpm oil:deploy`; set `VITE_OIL_FIELD_ADDRESS` afterward. The existing SEED deployment and original NFT routes are preserved. No new contract has been deployed by this change.

## Preserved SEED farm documentation

# Cloudacre — SvelteKit dapp

Svelte 5 + SvelteKit 2, Three.js, Reown AppKit, Ethers 6, and Solidity. The application contains no React components or React renderer. Architecture follows the user's SveltekitWeb3Starter (https://github.com/Zaunzi/SveltekitWeb3Starter), with the farm interface retained. The former React source is preserved locally in ignored outputs/react-prototype and in Git history.

## Play and inspect

- `/`: local demo, preserving the original cloudacre-demo-v1 save.
- `/nft/?token=1`: wallet-enabled Base Sepolia land page, including mint, harvest, and upgrades.
- `/embed/?token=1`: read-only 3D viewer; no wallet initialization or transaction controls.

The testnet page does not present demo state as chain state. Without a deployed address it shows an explicit unavailable state. The private Sites preview is not suitable as a public OpenSea animation URL.

## Local development

Use Node 22+ and pnpm 10.32.1.

```
pnpm install
pnpm contracts:compile
pnpm dev
pnpm check
pnpm test
pnpm build
```

Copy `env.example` to `.env` and set `VITE_PROJECT_ID`, `VITE_LAND_ADDRESS` and, optionally, a CORS-enabled `VITE_RPC_URL` for Base Sepolia. The user-supplied Reown project ID is configured in the local ignored `.env`. Only public client values use the VITE_ prefix. Allowlist the development and published origins in the Reown project dashboard. These values are embedded by the static build; rebuild after changing them.

## Testnet deployment

The deployment script intentionally permits Base Sepolia (84532) only. It has not been run against a public blockchain. Set `DEPLOY_RPC_URL`, `DEPLOY_PRIVATE_KEY`, and `PUBLIC_SITE_ORIGIN` in the deployment process environment, then run `pnpm contracts:deploy`. Use a funded testnet deployment wallet. Do not put private keys into client variables or source control. The script reads process environment; it does not automatically read `.env`.

`PUBLIC_SITE_ORIGIN` must be a publicly accessible HTTPS origin for the NFT viewer, with no path. The constructor freezes this origin; it cannot be changed after deployment. Use stable hosting. The script writes contract addresses and the transaction hash into ignored `deployments/base-sepolia.json`. Copy `land` into `VITE_LAND_ADDRESS`, then rebuild the frontend. The frontend discovers the associated SEED address from the land contract, not from user input.

After configuration, connect Reown on `/nft/`, switch to Base Sepolia, mint a test plot, collect 20 starter SEED, and buy terraced fields. Minting is free but requires network gas. Test transactions and OpenSea embedding on actual devices before a release.

## Contract behavior

`Cloudacre.sol` is an OpenZeppelin ERC-721 land contract. `Seed.sol` is a transferable ERC-20 reward token created by the land contract. Only the land contract can mint or burn SEED. The UI offers no mainnet transactions.

- One free faucet mint per wallet, with a collection cap of 1,000. This is a test faucet, not Sybil-resistant distribution.
- Production rates: 6 / 12 / 24 / 48 SEED per minute.
- Harvest caps: 20 / 40 / 80 / 160 SEED.
- Sequential upgrade costs: 20 / 45 / 90 SEED.
- Rewards use 18 decimals and block time. Production pauses at capacity.
- Harvest settles resources and mints SEED to the owner.
- Upgrades settle the old production rate, burn the caller's SEED and advance land level atomically.
- Only the current owner can farm. Approved NFT operators can transfer but cannot harvest or spend the owner's resources.
- Land upgrades and unharvested crops transfer with the NFT. Harvested tokens stay in the old owner's wallet.
- Onchain tokenURI returns a valid JSON data URI, an SVG preview, HTML animation_url, external_url, and dynamic traits. Upgrades emit ERC-4906 MetadataUpdate.

The economy is a prototype, not audited or suitable for valuable assets. Unlimited time-based emissions and wallet faucet creation need a deliberate production economic design before mainnet.

## Validation and limits

Contract tests run in an isolated local Ganache EVM. They cover ownership, repeat mint/claim restrictions, caps, old/new rate accounting, upgrade burns, insufficient balance rollback, transfer semantics, approved operators, token authority, all upgrade levels and metadata. Solidity compiler output generates the frontend ABI files.

Svelte diagnostics and production build are checked. Live wallet connection, public-chain transactions, browser visual QA, and OpenSea embedding have not been verified. The read-only embed requires a public host and reachable RPC. A project ID alone does not deploy a contract or make an NFT.

The user's public Reown project ID is also the source default so clean builds preserve wallet setup; VITE_PROJECT_ID overrides it. Optional WebMCP demo tools were migrated, but no supported validation context was available. They never submit wallet transactions.

