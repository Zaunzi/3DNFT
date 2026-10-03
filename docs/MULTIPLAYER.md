# Multiplayer presence

The Vercel browser connects to a separate Node WebSocket service. No database, blockchain writes or changes to the legacy site are needed. This service shares ephemeral player presence only. Building, items and parcel ownership remain governed by existing providers/contracts.

## Local

Run `node multiplayer/server.mjs` with repository dependencies installed, or `cd multiplayer`, `pnpm install`, `pnpm start` for an isolated service. Port defaults to 8787. The development world automatically connects to ws://127.0.0.1:8787. Default allowed origin is http://127.0.0.1:5177; set ALLOWED_ORIGINS for other Vite ports. Open two tabs, choose the same spawn parcel, enter and move away from the shared spawn to see the other player. Tests: `node --test multiplayer/server.test.mjs`.

## Railway + Vercel

1. Create a Railway service from this repository; set its root directory to `/multiplayer`. The included Dockerfile installs the isolated locked dependencies and starts the service. Keep a single replica and disable sleeping/serverless mode.
2. Set `ALLOWED_ORIGINS=https://atlas-mu-lime.vercel.app` (comma-separated exact origins for additional sites), `CHARACTER_ADDRESS` to the same CryptoDoodz contract as the website and `RPC_URL` to a Base RPC. No private key is needed. Railway supplies PORT.
3. Set healthcheck path `/health`. Generate a public domain.
4. In the Doodverse Vercel project only, set `VITE_MULTIPLAYER_URL=wss://YOUR-SERVICE.up.railway.app/` and redeploy. Keep existing build command/output and the legacy project's settings. No vercel.json is required.

Reference: https://docs.railway.com/deployments/monorepo and https://docs.railway.com/deployments/healthchecks.

## Identity and limits

Rooms include mode, chain, land contract, seed and generator version. Clients send 10 updates/second; the server sends at most 24 neighbors within 160 units. Clients interpolate position and shortest-path yaw, and animate Idle/Walk/Run/Jump. Departed players release their models. Reconnect preserves solo gameplay.

Guests receive a random cosmetic appearance from #1–#5000 per visit. This appearance is shared with peers and conveys no NFT ownership. Selected onchain characters request a personal-sign login message (no transaction). Server checks a single-use, expiring session challenge, wallet signature and current ownerOf against its configured collection on Base; ownership is rechecked every minute. Refusing login or failing verification leaves remote appearance as guest. For local testing, set `ALLOW_MOCK_AVATARS=true` on the server to share selected mock characters. This accepts cosmetic IDs only in isolated mock rooms; it never bypasses onchain authentication. Leave it disabled in production. No wallet address is broadcast to peers.

This is presence, not an authoritative game simulation: finite positions and bounds are validated, but movement is client-reported and portal-sized teleports are permitted. There is no combat, player collision, shared mock/localStorage building state, or secure proximity-based rewards. Do not use these positions to authorize assets or harvesting. Origin restrictions, 2 KiB payloads, per-connection rate limits, 100 connections, heartbeat cleanup and slow-client eviction bound the initial service. An origin header is not authentication or DDoS protection. Multiple replicas require shared room routing/state before scaling.

The server is not yet deployed. Local integration tests cover two-player synchronization, separation, distance filtering, disconnects and rejected inputs. Live wallet signing and Railway deployment require a configured service.
