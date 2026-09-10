# The Block: playable neighborhood

Route: `/cryptodoodz/world/`. Original CryptoDoodz models are loaded on demand from the existing collection. The shared Walk, Run, Jump and Shoot animations drive the avatar. Each new local profile receives a Glock, compact car, $500 game cash and ammunition.

Controls: WASD move, Shift sprint (stamina), mouse aim, click shoot, R reload, Space jump, E business interaction, F enter/exit a nearby car, Esc release pointer lock. Right-drag provides a camera fallback where pointer lock is unavailable.

Businesses: police station delivery jobs ($180), corner store snacks/ammo, weapon store with three guns, vehicle dealership with three cars, garage repairs. Target range awards $25 per destroyed target; targets respawn. Shooting outside the range raises police heat, triggering a simple pursuing patrol and a $75 citation. Cars have arcade acceleration/steering, collisions and condition-dependent top speed.

Current scope is a solo desktop browser sandbox with localStorage progress. Buildings have storefront interactions rather than walkable interiors. NPC pedestrians are ambient; combat is against range targets. There is no shared server, PvP, NFT ownership enforcement or real-money economy. Save state is intentionally client-controlled. Do not use it as an authoritative economy for multiplayer or on-chain rewards.

World geometry/materials are procedural and reused. The avatar and its six clips are existing collection assets. The Glock is a stylized game prop; all weapon behavior is game-only.

Tests: `node --test tests/hood.test.mjs` covers spawn inventory, purchases/overdraft prevention, save recovery and collision boundaries. Svelte/TypeScript diagnostics and the production build validate integration. Live gameplay/browser automation has not been performed in this task.
