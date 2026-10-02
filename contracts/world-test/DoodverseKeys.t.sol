// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseKeys} from "../src/DoodverseKeys.sol";
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
import {DoodverseNFTState} from "../src/DoodverseNFTState.sol";
interface KeysVm {function prank(address) external;function expectRevert() external;}
contract DoodverseKeysTest {
    KeysVm constant vm=KeysVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE);address constant BOB=address(0xB0B);address constant GUEST=address(0xCAFE);
    DoodverseParcels land;DoodverseKeys keys;DoodverseNFTState world;
    function setUp() public {land=new DoodverseParcels(1,"https://example.com/",address(this));vm.prank(ALICE);land.mint(1);world=new DoodverseNFTState(address(land),address(this));keys=new DoodverseKeys(address(land),address(this));keys.bindWorld(address(world));world.bindLockKeys(address(keys));}
    function door() private {vm.prank(ALICE);world.createKeyedDoor(0,3200,3200,0,50);}
    function testPausedKeysRollBackNewDoorsAndRekeys() public {
        door();keys.setMintPaused(true);
        vm.prank(ALICE);vm.expectRevert();world.createKeyedDoor(0,4000,4000,0,50);
        require(world.getDoors(0).length==1&&keys.nextKey()==1);
        vm.prank(ALICE);vm.expectRevert();world.rekeyDoor(0,1);
        require(keys.active(1)&&keys.nextKey()==1);
        vm.prank(ALICE);world.removeDoor(0,1);require(!keys.active(1));
        keys.setMintPaused(false);door();require(keys.nextKey()==2);
    }
    function testUniqueKeysCopiesRekeyAndDeletion() public {
        door();door();require(keys.balanceOf(ALICE,1)==1&&keys.balanceOf(ALICE,2)==1);
        vm.prank(ALICE);keys.issueCopies(1,GUEST,2);
        require(world.canOpen(0,1,GUEST)&&!world.canOpen(0,2,GUEST));
        vm.prank(BOB);vm.expectRevert();keys.issueCopies(1,BOB,1);
        vm.prank(BOB);vm.expectRevert();world.rekeyDoor(0,1);
        vm.prank(ALICE);world.rekeyDoor(0,1);require(!keys.active(1)&&!world.canOpen(0,1,GUEST));
        require(keys.balanceOf(GUEST,1)==2&&keys.balanceOf(ALICE,3)==1);
        vm.prank(ALICE);keys.issueCopies(3,GUEST,1);require(world.canOpen(0,1,GUEST));
        vm.prank(ALICE);world.removeDoor(0,1);require(!keys.active(3)&&!world.canOpen(0,1,GUEST));
    }
    function testTransferInvalidatesAndBuyerControls() public {
        door();vm.prank(ALICE);keys.issueCopies(1,GUEST,1);
        vm.prank(ALICE);land.transferFrom(ALICE,BOB,0);
        require(!keys.active(1)&&!world.canOpen(0,1,ALICE)&&!world.canOpen(0,1,GUEST)&&world.canOpen(0,1,BOB));
        vm.prank(ALICE);vm.expectRevert();world.rekeyDoor(0,1);
        vm.prank(BOB);world.rekeyDoor(0,1);require(keys.balanceOf(BOB,2)==1);
        vm.prank(BOB);land.transferFrom(BOB,ALICE,0);
        require(!keys.active(1)&&!keys.active(2)&&!world.canOpen(0,1,GUEST));
    }
    function testAtomicInvalidPlacementAndBindings() public {
        vm.prank(ALICE);vm.expectRevert();world.createKeyedDoor(0,0,0,0,0);
        require(keys.nextKey()==0&&world.getDoors(0).length==0);
        vm.expectRevert();keys.bindWorld(address(world));vm.expectRevert();world.bindLockKeys(address(keys));
        vm.prank(ALICE);vm.expectRevert();keys.create(0,ALICE);
        vm.prank(ALICE);vm.expectRevert();keys.revoke(1);
    }
    function testFuzzCopies(uint8 count) public {
        door();vm.prank(ALICE);if(count==0||count>100)vm.expectRevert();keys.issueCopies(1,GUEST,count);
        if(count>0&&count<=100)require(keys.balanceOf(GUEST,1)==count);
    }
}
