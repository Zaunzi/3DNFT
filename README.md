# Cloudacre prototype

Three.js floating farm with device-local demo resources. No wallet, contract, NFT minting, or real token distribution is connected.

Economy: 6 / 12 / 24 / 48 SEED per minute; storage caps 20 / 40 / 80 / 160. Sequential upgrades cost 20 / 45 / 90. Starts with one full harvest. Accrual uses elapsed wall time and stops at capacity. Demo storage is editable by the player and must never authorize real rewards.

Production phase: select a chain and reward design; implement authoritative harvest and upgrade accounting in contracts; attach permanent upgrades to token IDs; implement a dedicated wallet play page and a read-only embeddable view; then test an actual OpenSea item. The private Sites preview is not an OpenSea animation URL.

Validation: type check, production build, and economy unit checks. Browser visual QA and OpenSea embedding have not been performed.

Optional WebMCP read/harvest/upgrade tools are feature-detected; no supported validation context was available, so their browser integration is unverified.
