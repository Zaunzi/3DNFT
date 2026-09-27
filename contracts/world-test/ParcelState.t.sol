// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
import {ParcelState} from "../src/ParcelState.sol";
interface StateVm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function expectEmit(bool, bool, bool, bool, address) external;
}
contract ParcelStateTest {
    StateVm constant vm = StateVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    WorldParcelNFT nft;
    ParcelState state;
    address constant OWNER = address(0xA11CE);
    address constant OTHER = address(0xB0B);
    event ObjectPlaced(uint256 indexed tokenId, uint32 indexed objectId, uint8 objectType, uint16 x, uint16 z, uint16 rotation, uint32 revision);
    event ObjectRemoved(uint256 indexed tokenId, uint32 indexed objectId, uint32 revision);
    function setUp() public {
        nft = new WorldParcelNFT(7422026, "https://world.example/nft/", address(this));
        state = new ParcelState(address(nft));
        nft.mint(OWNER, 742); nft.mint(OTHER, 743);
    }
    function testPlaceRetrieveEventsAndRemove() public {
        vm.expectEmit(true, true, false, true, address(state)); emit ObjectPlaced(742, 1, 1, 1200, 2700, 9000, 1);
        vm.prank(OWNER); require(state.placeObject(742, 1, 1200, 2700, 9000) == 1);
        ParcelState.WorldObject[] memory objects = state.getObjects(742);
        require(objects.length == 1 && objects[0].x == 1200 && objects[0].rotation == 9000 && objects[0].objectType == 1);
        require(state.getObjects(743).length == 0);
        vm.expectEmit(true, true, false, true, address(state)); emit ObjectRemoved(742, 1, 2);
        vm.prank(OWNER); state.removeObject(742, 1);
        require(state.getObjects(742).length == 0 && state.revision(742) == 2);
    }
    function testOnlyCurrentOwnerNotApprovedOperator() public {
        vm.prank(OWNER); nft.approve(OTHER, 742);
        vm.prank(OTHER); vm.expectRevert(ParcelState.NotParcelOwner.selector); state.placeObject(742, 1, 1000, 1000, 0);
        vm.prank(OWNER); state.placeObject(742, 1, 1000, 1000, 0);
        vm.prank(OTHER); vm.expectRevert(ParcelState.NotParcelOwner.selector); state.removeObject(742, 1);
        vm.prank(OWNER); nft.transferFrom(OWNER, OTHER, 742);
        vm.prank(OWNER); vm.expectRevert(ParcelState.NotParcelOwner.selector); state.removeObject(742, 1);
        vm.prank(OTHER); state.removeObject(742, 1);
        vm.prank(OTHER); state.placeObject(742, 2, 1000, 1000, 0);
        require(state.getObjects(742)[0].id == 2);
    }
    function testBoundsTypesRotationAndUnminted() public {
        vm.startPrank(OWNER);
        vm.expectRevert(ParcelState.InvalidPlacement.selector); state.placeObject(742, 0, 1000, 1000, 0);
        vm.expectRevert(ParcelState.InvalidPlacement.selector); state.placeObject(742, 6, 1000, 1000, 0);
        vm.expectRevert(ParcelState.InvalidPlacement.selector); state.placeObject(742, 1, 0, 1000, 0);
        vm.expectRevert(ParcelState.InvalidPlacement.selector); state.placeObject(742, 1, 6400, 1000, 0);
        vm.expectRevert(ParcelState.InvalidPlacement.selector); state.placeObject(742, 2, 360, 1000, 0);
        vm.expectRevert(ParcelState.InvalidPlacement.selector); state.placeObject(742, 1, 1000, 1000, 36000);
        vm.expectRevert(); state.placeObject(744, 1, 1000, 1000, 0);
        state.placeObject(742, 1, 142, 6258, 35999);
        vm.stopPrank();
    }
    function testCapAndStableIdsAfterSwapPop() public {
        vm.startPrank(OWNER);
        for (uint32 i; i < 128; ++i) require(state.placeObject(742, 1, 1000, 1000, 0) == i + 1);
        vm.expectRevert(ParcelState.ParcelFull.selector); state.placeObject(742, 1, 1000, 1000, 0);
        state.removeObject(742, 1);
        require(state.getObjects(742)[0].id == 128);
        require(state.placeObject(742, 1, 1000, 1000, 0) == 129);
        state.removeObject(742, 128);
        vm.expectRevert(ParcelState.UnknownObject.selector); state.removeObject(742, 128);
        vm.stopPrank();
    }
    function testFuzzBounds(uint16 x, uint16 z, uint16 rotation, uint8 rawType) public {
        uint8 objectType = uint8(uint256(rawType) % 5 + 1);
        uint16 r = state.footprint(objectType);
        bool valid = x >= r && z >= r && x <= 6400-r && z <= 6400-r && rotation < 36000;
        vm.prank(OWNER);
        if (!valid) vm.expectRevert(ParcelState.InvalidPlacement.selector);
        state.placeObject(742, objectType, x, z, rotation);
        require(state.getObjects(742).length == (valid ? 1 : 0));
    }
    function testFuzzOwner(address caller) public {
        vm.prank(caller);
        if (caller != OWNER) vm.expectRevert(ParcelState.NotParcelOwner.selector);
        state.placeObject(742, 1, 1000, 1000, 0);
    }
    function testFuzzIds(uint32 candidate) public {
        vm.startPrank(OWNER); state.placeObject(742, 1, 1000, 1000, 0);
        if (candidate != 1) vm.expectRevert(ParcelState.UnknownObject.selector);
        state.removeObject(742, candidate);
        require(state.getObjects(742).length == (candidate == 1 ? 0 : 1)); vm.stopPrank();
    }
    function testFuzzValidCoordinatesAndRotation(uint16 rawX, uint16 rawZ, uint16 rawRotation) public {
        uint16 x = 142 + rawX % 6117; uint16 z = 142 + rawZ % 6117; uint16 rotation = rawRotation % 36000;
        vm.prank(OWNER); state.placeObject(742, 1, x, z, rotation);
        ParcelState.WorldObject memory object = state.getObjects(742)[0];
        require(object.x == x && object.z == z && object.rotation == rotation);
    }
}
