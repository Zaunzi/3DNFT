// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseCharacters} from "../src/DoodverseCharacters.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
interface CharacterVm {function expectRevert() external;function prank(address) external;}
contract CharacterReceiver is IERC721Receiver {
 DoodverseCharacters nft;bool reject;
 constructor(DoodverseCharacters n){nft=n;}
 function claim(bool r) external {reject=r;nft.mint(1);}
 function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4){require(!reject,"reject");(bool ok,)=address(nft).call(abi.encodeCall(nft.mint,(1)));require(!ok,"reentered");return this.onERC721Received.selector;}
}
contract DoodverseCharactersTest {
 CharacterVm constant vm=CharacterVm(address(uint160(uint256(keccak256("hevm cheat code")))));
 function testPublicMintAndTransferAllowance() public {
  DoodverseCharacters c=new DoodverseCharacters(address(this));address alice=address(0xA11CE);address bob=address(0xB0B);
  vm.prank(alice);c.mint(5);require(c.totalSupply()==5&&c.mintedBy(alice)==5&&c.ownerOf(1)==alice&&c.ownerOf(5)==alice);
  vm.prank(alice);c.transferFrom(alice,bob,1);vm.prank(alice);vm.expectRevert();c.mint(1);
  vm.prank(bob);c.mint(2);require(c.ownerOf(6)==bob&&c.ownerOf(7)==bob&&c.mintedBy(bob)==2);
 }
 function testMetadataPaddingAndBounds() public {
  DoodverseCharacters c=new DoodverseCharacters(address(this));vm.expectRevert();c.tokenURI(1);
  for(uint256 i;i<1000;i++){vm.prank(address(uint160(i+100)));c.mint(5);}
  uint256[5] memory ids=[uint256(1),10,100,1000,5000];string[5] memory names=[string("0001.json"),"0010.json","0100.json","1000.json","5000.json"];
  for(uint i;i<5;i++)require(keccak256(bytes(c.tokenURI(ids[i])))==keccak256(bytes(string.concat("https://atlas-mu-lime.vercel.app/cryptodoodz/metadata/",names[i]))));
  require(c.totalSupply()==5000);vm.prank(address(9000));vm.expectRevert();c.mint(1);
  vm.expectRevert();c.tokenURI(0);vm.expectRevert();c.tokenURI(5001);vm.expectRevert();c.mint(0);vm.expectRevert();c.mint(6);
 }
 function testFuzzMintAllowance(uint8 raw) public {
  DoodverseCharacters c=new DoodverseCharacters(address(this));uint256 quantity=1+uint256(raw)%5;
  vm.prank(address(99));c.mint(quantity);require(c.mintedBy(address(99))==quantity&&c.totalSupply()==quantity);
  for(uint i=1;i<=quantity;i++)require(c.ownerOf(i)==address(99));
 }
 function testReceiverReentryAndRollback() public {
  DoodverseCharacters c=new DoodverseCharacters(address(this));CharacterReceiver r=new CharacterReceiver(c);
  vm.expectRevert();r.claim(true);require(c.totalSupply()==0&&c.mintedBy(address(r))==0);
  r.claim(false);require(c.totalSupply()==1&&c.mintedBy(address(r))==1&&c.ownerOf(1)==address(r));
 }
}
