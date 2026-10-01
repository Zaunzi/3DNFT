// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseCharacters} from "../src/DoodverseCharacters.sol";
interface CharacterVm {function expectRevert() external;}
contract DoodverseCharactersTest {
    CharacterVm constant vm=CharacterVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testMetadataPaddingAndBounds() public {
        DoodverseCharacters c=new DoodverseCharacters(address(this));
        uint256[4] memory ids=[uint256(1),10,100,1000];
        string[4] memory suffixes=[string("0001.json"),"0010.json","0100.json","1000.json"];
        for(uint256 i;i<4;i++){c.mint(address(0xA11CE),ids[i]);require(keccak256(bytes(c.tokenURI(ids[i])))==keccak256(bytes(string.concat(c.METADATA_BASE(),suffixes[i]))));}
        vm.expectRevert();c.mint(address(0xA11CE),0);
        vm.expectRevert();c.mint(address(0xA11CE),1001);
        vm.expectRevert();c.tokenURI(2);
    }
}
