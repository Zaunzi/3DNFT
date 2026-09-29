# Modular building prototype (mock only)

Run `npm run dev:mock` and open the printed localhost URL with `/?tokenId=742`.
This overrides only state mode; it does not edit your Base environment or deploy contracts.
Connect the mock owner, enter the world, then press B.

The toolbar adds foundation, wall, doorway, window wall, roof tile, standing lantern,
and an Ancient Key locked door. New structures are **mock-only**. Base retains its
original five primitive types and portals. The deployed ParcelState contract rejects
additional types, so the onchain writer explicitly refuses these before simulation.
No new contracts, asset minting, crafting costs, or escrow changes are introduced.

## Assemble a base

- Foundations snap edge-to-edge to nearby foundations, inheriting height and rotation for flush floors. Occupied snap slots are skipped.
- Foundations and roofs are 4 x 4 meters; walls are 4 meters long.
- Walls, doorways, and window walls snap to the nearest foundation edge, inheriting its elevation and orientation. Roofs snap over a foundation with a supporting edge wall, or to either side of a standalone wall. The preview announces a snap. Entering manual X/Z coordinates bypasses structural snapping.
- Positions snap to a 0.5-meter parcel-local grid; R turns modular pieces by 90 degrees.
- The first structural placement fills the shared **Building base height**. All following
  pieces use that elevation. Clear it for a separate building; adjust it for uneven terrain.
- Optional Local X/Z fields provide exact meter coordinates. Blank fields follow the cursor.
- For a one-room example: foundation at (32,32), walls at (30,32) and (34,32) rotated
  90 degrees, window wall at (32,34), doorway at (32,30), and roof at (32,32).
  Put the locked door at the doorway's same coordinates and rotation. Use the same base height.
- Choosing a piece makes clicks place it even over existing structures. Use **Select / Remove**
  to select saved objects; Delete removes them. **Remove object...** opens a list of saved objects and portals with IDs and coordinates. Choose one to highlight it, then click **Remove chosen object**. A terrain hit is still required to confirm placement.
- Floor top is base + 0.5m. Walls extend from there to base + 3.7m; roofs sit above them.
  Lanterns stand at their base height: use floor height (base + 0.5) to put one indoors.
- Exit build mode, approach the door, and press E. Inventory's development grant can give
  you Ancient Key (item 4). The key must be wallet-held; the check does not consume it.
  E closes an open door. Delete locked doors from NFTs / Containers.

## State, collision, and limitations

New object IDs/types 7-12 retain the existing stable ID, owner authorization, parcel limits,
localStorage namespace, and streaming system. Optional `y` stores absolute world height
in centimeters, bounded to +/-320 meters; old objects omit it and still derive terrain Y.
Mock doors optionally store their floor height too. Portal remains toolbar ID 6, door ID 13
is a UI action that writes through the existing NFT provider, not a ParcelState object.

Foundations provide a level walkable surface. Walls and window walls block movement;
doorway posts leave an opening that the existing key-checked door can block. Movement
uses short substeps to prevent sprinting through thin walls. Up to four nearest lanterns
cast warm, unshadowed point light; all lanterns remain emissive. Streaming releases lights
and uses shared geometry/materials for structure templates.

This prototype has no structural-support rules,
resource costs, or automatic terrain clearing. Choose a reasonably level patch and adjust
the shared base height; terrain can intrude on steep slopes. Doors enforce client movement,
not protection of secrets or onchain assets; custody authorization remains contract/provider
controlled. New builds inherit mock parcel ownership and survive refresh.

A future Base expansion must add versioned storage and read old and new deployments together,
not relabel old type IDs. Explicit elevation also needs contract validation. This change
intentionally does not prepare or deploy that upgrade.

## Entrance stairs

Choose **Entrance stairs** in mock build mode. Four 25cm steps span a 2m-wide, 2m-long flight. Near a foundation edge they rotate toward it and match its floor height automatically. Walk up normally with WASD. Manual X/Z overrides snapping; the base height then sets the bottom of the stairs. Steps persist and can be removed like other building pieces. These are entrance steps, not a full-storey staircase.

## Multiple stories

Aim at the **upper part of an existing wall** while placing a wall, doorway, or window
wall to stack a story above it. Aim lower and toward an end to extend that wall sideways.
The new piece inherits its rotation and elevation. Aim at a wall with Roof selected to
place the floor/roof on that wall's side. Storeys repeat every 3.4m, including the floor
slab. Roof tiles are walkable and continue to block jumping from underneath.

Choose **Storey staircase** to connect the level below to a roof/floor edge. Its fourteen
steps rise 3.4m over a 4m run. Snapping places the staircase outside the floor footprint,
so you can ascend without a ceiling in the way. Leave its route clear of walls and upper
floor tiles. Entrance stairs remain the short 1m flight. This is still mock-only; there
is no structural stability simulation or automatic stairwell cutting. Manual coordinates
bypass snapping, and parcel bounds and the 128-object limit still apply.
