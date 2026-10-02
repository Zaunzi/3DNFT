// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseTrinkets} from "../src/DoodverseTrinkets.sol";
import {DoodverseItems} from "../src/DoodverseItems.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
contract ClaimReceiver is ERC1155Holder {
 DoodverseTrinkets public token;bool public duplicateSucceeded;bool public reject;
 constructor(DoodverseTrinkets t){token=t;}
 function claim(bool shouldReject) external {reject=shouldReject;token.mint(1);}
 function onERC1155Received(address,address,uint256,uint256,bytes memory) public override returns(bytes4){
  require(!reject,"reject");(duplicateSucceeded,)=address(token).call(abi.encodeWithSignature("mint(uint256)",1));return this.onERC1155Received.selector;
 }
}
interface TrinketVm {function prank(address) external;function expectRevert() external;}
contract DoodverseTrinketsTest {
    TrinketVm constant vm=TrinketVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testCatalogAndSeparateBalances() public {
        DoodverseTrinkets trinkets=new DoodverseTrinkets(address(this));
        DoodverseItems utility=new DoodverseItems(address(this),"https://example.com/{id}.json");
        address alice=address(0xA11CE);
        for(uint256 id=1;id<=5;id++){vm.prank(alice);trinkets.mint(id);require(trinkets.balanceOf(alice,id)==1);require(bytes(trinkets.uri(id)).length>0);}
        require(utility.balanceOf(alice,4)==0);
        utility.mint(alice,4,1);require(utility.balanceOf(alice,4)==1&&trinkets.balanceOf(alice,4)==1);
        require(keccak256(bytes(trinkets.uri(4)))==keccak256(bytes("https://3dnft.vercel.app/trinkets/metadata/4.json")));
        vm.prank(alice);vm.expectRevert();trinkets.mint(alice,1,1);
        vm.expectRevert();trinkets.mint(alice,0,1);
        vm.expectRevert();trinkets.mint(alice,6,1);
        vm.expectRevert();trinkets.mint(alice,1,0);
        vm.expectRevert();trinkets.uri(6);
    }
    function testTransferDoesNotResetAllowance() public {
        DoodverseTrinkets t=new DoodverseTrinkets(address(this));address alice=address(0xA11CE);address bob=address(0xB0B);
        vm.prank(alice);t.mint(1);vm.prank(alice);t.safeTransferFrom(alice,bob,1,1,"");
        vm.prank(alice);vm.expectRevert();t.mint(1);
        vm.prank(bob);t.mint(1);require(t.balanceOf(bob,1)==2); // limit is minting, not transferable holdings
    }
    function testFuzzOnePerWalletPerId(address user,uint8 rawId) public {
        if(user==address(0)||user.code.length>0)return;
        DoodverseTrinkets t=new DoodverseTrinkets(address(this));uint256 id=uint256(rawId)%5+1;
        vm.prank(user);t.mint(id);require(t.minted(user,id)&&t.balanceOf(user,id)==1);
        vm.prank(user);vm.expectRevert();t.mint(id);
        vm.prank(user);vm.expectRevert();t.mint(user,id,1);
        vm.prank(user);vm.expectRevert();t.mint(user,id,2);
    }
    function testReceiverCallbackAndRejection() public {
        DoodverseTrinkets t=new DoodverseTrinkets(address(this));ClaimReceiver r=new ClaimReceiver(t);
        vm.expectRevert();r.claim(true);require(!t.minted(address(r),1)&&t.balanceOf(address(r),1)==0);
        r.claim(false);require(!r.duplicateSucceeded()&&t.minted(address(r),1)&&t.balanceOf(address(r),1)==1);
    }
}

