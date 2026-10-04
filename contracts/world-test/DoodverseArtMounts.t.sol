// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseArtMounts} from "../src/DoodverseArtMounts.sol";
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
import {DoodverseParcelState} from "../src/DoodverseParcelState.sol";
import {DoodverseNFTState} from "../src/DoodverseNFTState.sol";
import {WorldEditionState} from "../src/WorldEditionState.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
interface MountVm {function prank(address) external;function expectRevert() external;}
contract MountNFT is ERC721 {constructor() ERC721("Art","ART"){} function mint(address to) external {_mint(to,1);}}
contract MountEdition is ERC1155 {constructor() ERC1155(""){} function mint(address to) external {_mint(to,14,2,"");}}
contract DoodverseArtMountsTest {
    MountVm constant vm=MountVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant A=address(0xA);address constant B=address(0xB);
    DoodverseParcels land;DoodverseParcelState parcels;DoodverseNFTState nfts;WorldEditionState editions;DoodverseArtMounts mounts;MountNFT nft;MountEdition edition;
    uint32 low;uint32 high;
    function setUp() public {
        land=new DoodverseParcels(1,"https://example.com/",address(this));vm.prank(A);land.mint(2);
        parcels=new DoodverseParcelState(address(land));nfts=new DoodverseNFTState(address(land),address(this));editions=new WorldEditionState(address(land));
        mounts=new DoodverseArtMounts(address(land),address(parcels),address(nfts),address(editions));
        vm.prank(A);low=parcels.placeObject(0,8,3200,3200,0,100);
        vm.prank(A);high=parcels.placeObject(0,8,3200,3200,0,400);
        nft=new MountNFT();nft.mint(A);vm.prank(A);nft.approve(address(nfts),1);
        vm.prank(A);nfts.attach(address(nft),1,loc721());
        edition=new MountEdition();edition.mint(A);vm.prank(A);edition.setApprovalForAll(address(editions),true);
        vm.prank(A);editions.attach(address(edition),14,1,loc1155());
    }
    function loc721() private pure returns(DoodverseNFTState.Location memory){return DoodverseNFTState.Location(0,0,3200,3228,0);}
    function loc1155() private pure returns(WorldEditionState.Location memory){return WorldEditionState.Location(0,3200,3228,0);}
    function save721(uint32 wall) private {vm.prank(A);mounts.set721(address(nft),1,keccak256(abi.encode(loc721())),wall);}
    function save1155(uint32 wall) private {vm.prank(A);mounts.set1155(1,keccak256(abi.encode(loc1155())),wall);}
    function testExactFloorIndependentForBothStandardsAndGround() public {
        save721(low);save1155(high);
        require(mounts.get721(address(nft),1).wallId==low&&mounts.get1155(1).wallId==high);
        save721(high);save1155(low);
        require(mounts.get721(address(nft),1).wallId==high&&mounts.get1155(1).wallId==low);
        save721(0);require(mounts.get721(address(nft),1).saved&&mounts.get721(address(nft),1).wallId==0);
        require(nft.ownerOf(1)==address(nfts)&&edition.balanceOf(address(editions),14)==1);
    }
    function testOnlyCurrentParcelOwnerAndSalePreservesAnchors() public {
        save721(low);save1155(low);vm.prank(A);land.transferFrom(A,B,0);
        vm.expectRevert();save721(high);vm.expectRevert();save1155(high);
        require(mounts.get721(address(nft),1).wallId==low);
        vm.prank(B);mounts.set721(address(nft),1,keccak256(abi.encode(loc721())),high);
        vm.prank(B);mounts.set1155(1,keccak256(abi.encode(loc1155())),high);
    }
    function testChangedPoseRejectsPendingSaveAndDoesNotInheritMount() public {
        save721(low);save1155(low);
        DoodverseNFTState.Location memory l=loc721();l.x=3300;vm.prank(A);nfts.move(address(nft),1,l);
        WorldEditionState.Location memory e=loc1155();e.x=3300;vm.prank(A);editions.move(1,e);
        vm.expectRevert();save721(high);vm.expectRevert();save1155(high);
        require(!mounts.get721(address(nft),1).saved&&!mounts.get1155(1).saved);
    }
    function testInvalidDeletedAndOtherParcelWallsRejected() public {
        vm.expectRevert();save721(999);vm.expectRevert();save1155(999);
        vm.prank(A);parcels.removeObject(0,low);vm.expectRevert();save721(low);
        vm.prank(A);uint32 tree=parcels.placeObject(0,4,4000,4000,0,0);vm.expectRevert();save1155(tree);
    }
    function testDetachedAssetsCannotSaveAndNewEditionDoesNotReuseAnchor() public {
        save721(low);save1155(low);vm.prank(A);nfts.detach(address(nft),1);vm.prank(A);editions.detach(1);
        vm.expectRevert();save721(high);vm.expectRevert();save1155(high);
        vm.prank(A);uint256 id=editions.attach(address(edition),14,1,loc1155());require(id==2&&!mounts.get1155(id).saved);
    }
}
