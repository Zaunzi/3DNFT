// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
import {DoodverseParcelState} from "../src/DoodverseParcelState.sol";
interface BuildV2Vm {function prank(address) external; function expectRevert() external;}
contract DoodverseParcelStateTest {
    BuildV2Vm constant vm=BuildV2Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    WorldParcelNFT land; DoodverseParcelState state;
    address constant ALICE=address(0xA11CE); address constant BOB=address(0xB0B);
    function setUp() public {land=new WorldParcelNFT(7422026,"https://atlas-mu-lime.vercel.app/",address(this));state=new DoodverseParcelState(address(land));land.mint(ALICE,742);}
    function testCatalogAndRemoval() public {
        uint8[13] memory types=[uint8(1),2,3,4,5,7,8,9,10,11,12,14,15];
        for(uint256 i;i<types.length;i++){vm.prank(ALICE);state.placeObject(742,types[i],3200,3200,9000,types[i]<7?int16(0):int16(190));}
        require(state.getObjects(742).length==13);
        vm.prank(ALICE);state.removeObject(742,1);
        require(state.getObjects(742)[0].id==13);
        vm.prank(ALICE);require(state.placeObject(742,7,3200,3200,0,-190)==14);
    }
    function testOwnerTransfer() public {
        vm.prank(ALICE);state.placeObject(742,7,3200,3200,0,390);
        vm.prank(ALICE);land.approve(BOB,742);
        vm.prank(BOB);vm.expectRevert();state.removeObject(742,1);
        vm.prank(ALICE);land.transferFrom(ALICE,BOB,742);
        require(state.getObjects(742)[0].y==390);
        vm.prank(ALICE);vm.expectRevert();state.removeObject(742,1);
        vm.prank(BOB);state.removeObject(742,1);
    }
    function testInvalidPlacement() public {
        vm.prank(ALICE);vm.expectRevert();state.placeObject(742,6,3200,3200,0,0);
        vm.prank(ALICE);vm.expectRevert();state.placeObject(742,13,3200,3200,0,0);
        vm.prank(ALICE);vm.expectRevert();state.placeObject(742,7,3200,3200,1,0);
        vm.prank(ALICE);vm.expectRevert();state.placeObject(742,7,3200,3200,0,32001);
        vm.prank(ALICE);vm.expectRevert();state.placeObject(742,1,3200,3200,0,1);
    }
    function testFuzzBounds(uint16 x,uint16 z,uint16 rotation,int16 y) public {
        bool valid=x>=283&&x<=6117&&z>=283&&z<=6117&&rotation<36000&&rotation%9000==0&&y>=-32000&&y<=32000;
        vm.prank(ALICE);if(!valid)vm.expectRevert();state.placeObject(742,7,x,z,rotation,y);
        if(valid)require(state.getObjects(742)[0].y==y);
    }
    function testFuzzValidModularPlacement(uint16 rawX,uint16 rawZ,uint8 turns,int16 rawY) public {
        uint16 x=283+rawX%5835; uint16 z=283+rawZ%5835;
        int16 y=int16(int256(rawY)%32001);
        vm.prank(ALICE);state.placeObject(742,7,x,z,uint16(turns%4)*9000,y);
        DoodverseParcelState.WorldObject memory o=state.getObjects(742)[0];
        require(o.x==x&&o.z==z&&o.y==y);
    }
    function testCapacityAndNeverReusedIds() public {
        for(uint256 i;i<128;i++){vm.prank(ALICE);state.placeObject(742,7,3200,3200,0,0);}
        vm.prank(ALICE);vm.expectRevert();state.placeObject(742,7,3200,3200,0,0);
        vm.prank(ALICE);state.removeObject(742,64);
        vm.prank(ALICE);require(state.placeObject(742,7,3200,3200,0,0)==129);
    }
}
