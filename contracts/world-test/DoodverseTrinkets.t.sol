// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseTrinkets} from "../src/DoodverseTrinkets.sol";
import {DoodverseItems} from "../src/DoodverseItems.sol";
interface TrinketVm {function prank(address) external;function expectRevert() external;}
contract DoodverseTrinketsTest {
    TrinketVm constant vm=TrinketVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testCatalogAndSeparateBalances() public {
        DoodverseTrinkets trinkets=new DoodverseTrinkets(address(this));
        DoodverseItems utility=new DoodverseItems(address(this),"https://example.com/{id}.json");
        address alice=address(0xA11CE);
        for(uint256 id=1;id<=5;id++){trinkets.mint(alice,id,2);require(trinkets.balanceOf(alice,id)==2);require(bytes(trinkets.uri(id)).length>0);}
        require(utility.balanceOf(alice,4)==0);
        utility.mint(alice,4,1);require(utility.balanceOf(alice,4)==1&&trinkets.balanceOf(alice,4)==2);
        require(keccak256(bytes(trinkets.uri(4)))==keccak256(bytes("https://3dnft.vercel.app/trinkets/metadata/4.json")));
        vm.prank(alice);vm.expectRevert();trinkets.mint(alice,1,1);
        vm.expectRevert();trinkets.mint(alice,0,1);
        vm.expectRevert();trinkets.mint(alice,6,1);
        vm.expectRevert();trinkets.mint(alice,1,0);
        vm.expectRevert();trinkets.uri(6);
    }
}
