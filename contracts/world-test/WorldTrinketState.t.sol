// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldTrinketState} from "../src/WorldTrinketState.sol";
import {DoodverseTrinkets} from "../src/DoodverseTrinkets.sol";
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
interface TrinketStateVm {function prank(address) external;function expectRevert() external;}
contract TrinketCustodyFixture is DoodverseTrinkets {
 constructor() DoodverseTrinkets(msg.sender) {}
 function fixtureMint(address to,uint256 id,uint256 quantity) external {_mint(to,id,quantity,"");}
}
contract RejectTrinketReceiver {}
contract ReenterTrinketReceiver is ERC1155Holder {
 WorldTrinketState state;bool public attempted;bool public reentered;
 constructor(WorldTrinketState s){state=s;}
 function collect() external {state.pickupItem(0,1);}
 function onERC1155Received(address,address,uint256,uint256,bytes memory) public override returns(bytes4){attempted=true;(reentered,)=address(state).call(abi.encodeCall(state.pickupItem,(0,1)));return this.onERC1155Received.selector;}
}
contract WorldTrinketStateTest {
 TrinketStateVm constant vm=TrinketStateVm(address(uint160(uint256(keccak256("hevm cheat code")))));
 address constant ALICE=address(0xA11CE);address constant BOB=address(0xB0B);
 DoodverseParcels land;TrinketCustodyFixture items;WorldTrinketState state;
 function setUp() public {land=new DoodverseParcels(1,"https://example.com/",address(this));items=new TrinketCustodyFixture();state=new WorldTrinketState(address(land),address(items));vm.prank(ALICE);land.mint(1);items.fixtureMint(ALICE,1,70);vm.prank(ALICE);items.setApprovalForAll(address(state),true);}
 function place() private {vm.prank(ALICE);state.placeItem(0,1,1,3200,3200,0);}
 function testSaleInheritanceAndNoDuplication() public {place();require(items.balanceOf(ALICE,1)==69&&items.balanceOf(address(state),1)==1&&state.escrowed(1)==1);vm.prank(ALICE);land.transferFrom(ALICE,BOB,0);vm.prank(ALICE);vm.expectRevert();state.pickupItem(0,1);vm.prank(BOB);state.pickupItem(0,1);require(items.balanceOf(BOB,1)==1&&items.balanceOf(ALICE,1)==69&&state.getItems(0).length==0&&state.escrowed(1)==0);vm.prank(BOB);vm.expectRevert();state.pickupItem(0,1);}
 function testAuthorizationAndUnsolicitedTransfers() public {vm.prank(BOB);vm.expectRevert();state.placeItem(0,1,1,3200,3200,0);vm.prank(ALICE);vm.expectRevert();items.safeTransferFrom(ALICE,address(state),1,1,"");require(state.getItems(0).length==0&&items.balanceOf(ALICE,1)==70);}
 function testCapacityStableIdsAndRemoval() public {for(uint i;i<64;i++)place();vm.prank(ALICE);vm.expectRevert();state.placeItem(0,1,1,3200,3200,0);vm.prank(ALICE);state.pickupItem(0,20);place();WorldTrinketState.Instance[] memory rows=state.getItems(0);require(rows.length==64&&rows[63].id==65&&rows[19].id==64);}
 function testWithdrawalRejectionRollsBack() public {place();address rejecting=address(new RejectTrinketReceiver());vm.prank(ALICE);land.transferFrom(ALICE,rejecting,0);vm.prank(rejecting);vm.expectRevert();state.pickupItem(0,1);require(state.getItems(0).length==1&&items.balanceOf(address(state),1)==1&&state.escrowed(1)==1);}
 function testReceiverCannotReenterPickup() public {place();ReenterTrinketReceiver receiver=new ReenterTrinketReceiver(state);vm.prank(ALICE);land.transferFrom(ALICE,address(receiver),0);receiver.collect();require(receiver.attempted()&&!receiver.reentered()&&items.balanceOf(address(receiver),1)==1&&state.getItems(0).length==0);}
 function testFuzzBounds(uint16 x,uint16 z,uint16 rotation,uint16 kind,uint64 quantity) public {bool valid=x>=200&&x<=6200&&z>=200&&z<=6200&&rotation<36000&&kind>=1&&kind<=5&&quantity==1;if(valid){items.fixtureMint(ALICE,kind,1);vm.prank(ALICE);state.placeItem(0,kind,quantity,x,z,rotation);require(state.getItems(0).length==1);}else{vm.prank(ALICE);vm.expectRevert();state.placeItem(0,kind,quantity,x,z,rotation);require(state.getItems(0).length==0);}}
 function testFuzzValidPickup(uint16 x,uint16 z,uint16 rotation,uint8 kind) public {uint16 k=uint16(kind%5)+1;items.fixtureMint(ALICE,k,1);vm.prank(ALICE);uint32 id=state.placeItem(0,k,1,200+x%6001,200+z%6001,rotation%36000);vm.prank(ALICE);land.transferFrom(ALICE,BOB,0);vm.prank(BOB);state.pickupItem(0,id);require(items.balanceOf(BOB,k)==1&&state.escrowed(k)==0);}
}

