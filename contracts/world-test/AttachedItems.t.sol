// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
import {AtlasItems} from "../src/AtlasItems.sol";
import {WorldItemState} from "../src/WorldItemState.sol";
import {ParcelState} from "../src/ParcelState.sol";
import {PortalState} from "../src/PortalState.sol";
interface AttachedVm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}
contract AttachedItemsTest {
    AttachedVm constant vm = AttachedVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    function testFuzzAttachedItemsFollowLand(uint64 input, bool clear) public {
        uint64 quantity = uint64(uint256(input) % 1_000_000 + 1);
        WorldParcelNFT land = new WorldParcelNFT(7422026, "https://world.example/nft/", address(this));
        AtlasItems items = new AtlasItems(address(this), "ipfs://items/{id}");
        WorldItemState state = new WorldItemState(address(land), address(items));
        ParcelState buildings = new ParcelState(address(land));
        PortalState portals = new PortalState(address(land));
        land.mint(ALICE, 742);
        items.mint(ALICE, 3, uint256(quantity) + 7);
        items.mint(ALICE, 2, 19);
        vm.prank(ALICE); buildings.placeObject(742, 1, 3200, 3200, 0);
        vm.prank(ALICE); portals.placePortal(742, 742, 3200, 3200, 0);
        vm.prank(ALICE); items.setApprovalForAll(address(state), true);
        vm.prank(ALICE); uint32 id = state.placeItem(742, 3, quantity, 3200, 3200, 0);
        require(items.balanceOf(ALICE, 3) == 7 && state.escrowed(3) == quantity, "Attach duplicated balance");
        bytes32 beforeTransfer = keccak256(abi.encode(buildings.getObjects(742), portals.getPortals(742), state.getItems(742)));
        vm.prank(ALICE); land.transferFrom(ALICE, BOB, 742);
        require(beforeTransfer == keccak256(abi.encode(buildings.getObjects(742), portals.getPortals(742), state.getItems(742))), "Transfer changed attached state");
        require(state.getItems(742)[0].depositor == ALICE, "Provenance changed");
        require(items.balanceOf(address(state), 3) == quantity, "Items must stay attached");
        require(buildings.getObjects(742).length == 1 && portals.getPortals(742).length == 1, "Transfer removed parcel state");
        vm.prank(ALICE); vm.expectRevert(ParcelState.NotParcelOwner.selector); buildings.removeObject(742, 1);
        vm.prank(ALICE); vm.expectRevert(PortalState.Unauthorized.selector); portals.removePortal(742, 1);
        vm.prank(BOB); buildings.removeObject(742, 1);
        vm.prank(BOB); portals.removePortal(742, 1);
        vm.prank(ALICE); vm.expectRevert(WorldItemState.Unauthorized.selector); state.pickupItem(742, id);
        vm.prank(ALICE); vm.expectRevert(WorldItemState.Unauthorized.selector); state.evictItem(742, id);
        vm.prank(BOB);
        if (clear) state.evictItem(742, id); else state.pickupItem(742, id);
        require(items.balanceOf(BOB, 3) == quantity, "Buyer must receive items");
        require(items.balanceOf(ALICE, 3) == 7 && items.balanceOf(ALICE, 2) == 19, "Unattached inventory changed");
        require(items.balanceOf(address(state), 3) == 0, "Escrow duplicated balance");
        require(state.getItems(742).length == 0 && state.escrowed(3) == 0, "Claim not cleared");
        vm.prank(BOB); vm.expectRevert(WorldItemState.UnknownInstance.selector); state.pickupItem(742, id);
    }
}
