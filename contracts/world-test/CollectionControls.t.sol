// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {CollectionControls} from "../src/CollectionControls.sol";
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
import {DoodverseCharacters} from "../src/DoodverseCharacters.sol";
import {DoodverseTrinkets} from "../src/DoodverseTrinkets.sol";
import {DoodverseItems} from "../src/DoodverseItems.sol";
import {DoodverseKeys} from "../src/DoodverseKeys.sol";
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
import {AtlasCharacters} from "../src/AtlasCharacters.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface AdminVm {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool, bool, bool, bool, address) external;
}
contract KeyIssuerFixture {
    address public immutable land;
    constructor(address target) { land = target; }
    function issue(DoodverseKeys keys, uint16 parcel, address controller) external returns(uint256) {
        return keys.create(parcel, controller);
    }
}
contract CollectionControlsTest {
    AdminVm constant vm=AdminVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE);
    address constant BOB=address(0xB0B);
    DoodverseParcels land;
    DoodverseCharacters characters;
    DoodverseTrinkets trinkets;
    DoodverseItems items;
    DoodverseKeys keys;
    KeyIssuerFixture issuer;
    event MintPausedChanged(bool paused);
    event MetadataURIUpdated(string metadataURI);
    event BatchMetadataUpdate(uint256 from, uint256 to);
    event URI(string value, uint256 indexed id);

    function setUp() public {
        land=new DoodverseParcels(7422026,"https://example.com/",address(this));
        characters=new DoodverseCharacters(address(this));
        trinkets=new DoodverseTrinkets(address(this));
        items=new DoodverseItems(address(this),"ipfs://original/{id}.json");
        keys=new DoodverseKeys(address(land),address(this));
        issuer=new KeyIssuerFixture(address(land));keys.bindWorld(address(issuer));
        vm.prank(ALICE);land.mint(2);
        vm.prank(ALICE);characters.mint(2);
        vm.prank(ALICE);trinkets.mint(1);
        items.mint(ALICE,1,3);
        issuer.issue(keys,0,ALICE);
    }
    function collections() private view returns(address[5] memory) {
        return [address(land),address(characters),address(trinkets),address(items),address(keys)];
    }
    function metadataCalls() private pure returns(bytes[5] memory) {
        return [abi.encodeWithSignature("setMetadataBaseURI(string)","ipfs://new/"),
                abi.encodeWithSignature("setMetadataBaseURI(string)","ipfs://new/"),
                abi.encodeWithSignature("setMetadataBaseURI(string)","ipfs://new/"),
                abi.encodeWithSignature("setURI(string)","ipfs://new/{id}.json"),
                abi.encodeWithSignature("setURI(string)","ipfs://new/{id}.json")];
    }
    function testFuzzOnlyOwnerCanAdminister(address attacker) public {
        if(attacker==address(this))return;
        address[5] memory targets=collections();bytes[5] memory calls=metadataCalls();
        for(uint256 i;i<targets.length;i++) {
            vm.prank(attacker);
            (bool ok,bytes memory reason)=targets[i].call(abi.encodeCall(CollectionControls.setMintPaused,(true)));
            require(!ok&&keccak256(reason)==keccak256(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector,attacker)));
            vm.prank(attacker);(ok,reason)=targets[i].call(calls[i]);
            require(!ok&&keccak256(reason)==keccak256(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector,attacker)));
        }
        vm.prank(attacker);vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector,attacker));land.setRuntimeURL("https://new.example/");
    }
    function testPausingBlocksAllMintRoutesWithoutConsumingAllowance() public {
        for(uint256 i;i<5;i++)CollectionControls(collections()[i]).setMintPaused(true);
        vm.prank(ALICE);vm.expectRevert(CollectionControls.MintingPaused.selector);land.mint(1);
        vm.prank(ALICE);vm.expectRevert(CollectionControls.MintingPaused.selector);characters.mint(1);
        vm.prank(ALICE);vm.expectRevert(CollectionControls.MintingPaused.selector);trinkets.mint(2);
        vm.prank(ALICE);vm.expectRevert(CollectionControls.MintingPaused.selector);trinkets.mint(ALICE,2,1);
        vm.expectRevert(CollectionControls.MintingPaused.selector);items.mint(ALICE,1,1);
        vm.expectRevert(CollectionControls.MintingPaused.selector);issuer.issue(keys,0,ALICE);
        vm.prank(ALICE);vm.expectRevert(CollectionControls.MintingPaused.selector);keys.issueCopies(1,BOB,1);
        require(land.totalSupply()==2&&land.mintedBy(ALICE)==2);
        require(characters.totalSupply()==2&&characters.mintedBy(ALICE)==2);
        require(!trinkets.minted(ALICE,2)&&keys.nextKey()==1&&items.balanceOf(ALICE,1)==3);
        for(uint256 i;i<5;i++)CollectionControls(collections()[i]).setMintPaused(false);
        vm.prank(ALICE);land.mint(1);require(land.ownerOf(2)==ALICE);
        vm.prank(ALICE);characters.mint(1);require(characters.ownerOf(3)==ALICE);
        vm.prank(ALICE);trinkets.mint(ALICE,2,1);require(trinkets.balanceOf(ALICE,2)==1);
        items.mint(ALICE,1,1);require(items.balanceOf(ALICE,1)==4);
        require(issuer.issue(keys,0,ALICE)==2);
        vm.prank(ALICE);keys.issueCopies(1,BOB,1);require(keys.balanceOf(BOB,1)==1);
    }
    function testTransfersAndExistingKeysRemainUsableWhilePaused() public {
        for(uint256 i;i<5;i++)CollectionControls(collections()[i]).setMintPaused(true);
        vm.prank(ALICE);characters.transferFrom(ALICE,BOB,1);
        vm.prank(ALICE);trinkets.safeTransferFrom(ALICE,BOB,1,1,"");
        vm.prank(ALICE);items.safeTransferFrom(ALICE,BOB,1,1,"");
        vm.prank(ALICE);keys.safeTransferFrom(ALICE,BOB,1,1,"");
        require(keys.canUse(1,BOB));
        vm.prank(ALICE);land.transferFrom(ALICE,BOB,0);
        require(!keys.canUse(1,BOB)); // Ownership epoch rules remain authoritative.
        require(land.ownerOf(0)==BOB&&characters.ownerOf(1)==BOB&&trinkets.balanceOf(BOB,1)==1);
    }
    function testMetadataUpdatesExistingAndFutureTokensAndEmitsEvents() public {
        vm.expectEmit(false,false,false,true,address(characters));emit MetadataURIUpdated("ipfs://characters/");
        vm.expectEmit(false,false,false,true,address(characters));emit BatchMetadataUpdate(1,2);
        characters.setMetadataBaseURI("ipfs://characters/");
        equal(characters.tokenURI(1),"ipfs://characters/0001.json");
        vm.prank(ALICE);characters.mint(1);equal(characters.tokenURI(3),"ipfs://characters/0003.json");
        require(characters.supportsInterface(0x49064906)&&land.supportsInterface(0x49064906));
        trinkets.setMetadataBaseURI("https://new.example/trinkets/");
        equal(trinkets.uri(1),"https://new.example/trinkets/1.json");
        equal(trinkets.uri(5),"https://new.example/trinkets/5.json");
        items.setURI("ipfs://items/{id}.json");equal(items.uri(1),"ipfs://items/{id}.json");
        keys.setURI("ipfs://keys/{id}.json");equal(keys.uri(1),"ipfs://keys/{id}.json");
        require(keys.canUse(1,ALICE));
        land.setMetadataBaseURI("ipfs://land/");equal(land.tokenURI(0),"ipfs://land/0.json");
        vm.prank(ALICE);land.mint(1);equal(land.tokenURI(2),"ipfs://land/2.json");
    }
    function testGeneratedParcelMetadataRuntimeValidationAndRestore() public {
        string memory original=land.tokenURI(0);
        land.setRuntimeURL("https://new.example/world/");
        require(keccak256(bytes(original))!=keccak256(bytes(land.tokenURI(0))));
        equal(land.runtimeURL(),"https://new.example/world/");
        land.setMetadataBaseURI("ipfs://land/");land.setMetadataBaseURI("");
        land.setRuntimeURL("https://example.com/");equal(land.tokenURI(0),original);
        vm.expectRevert(DoodverseParcels.InvalidRuntimeURL.selector);land.setRuntimeURL("https://example.com/?bad");
        vm.expectRevert(DoodverseParcels.InvalidRuntimeURL.selector);land.setRuntimeURL("x");
        vm.expectRevert(CollectionControls.InvalidMetadataURI.selector);characters.setMetadataBaseURI("");
        vm.expectRevert(CollectionControls.InvalidMetadataURI.selector);trinkets.setMetadataBaseURI("ipfs://no-slash");
        vm.expectRevert(CollectionControls.InvalidMetadataURI.selector);items.setURI("");
        vm.expectRevert(CollectionControls.InvalidMetadataURI.selector);keys.setURI("");
        require(land.collectionSeed()==7422026&&land.ownershipEpoch(0)==1);
    }
    function testOwnershipTransferMovesAdminRightsForEveryCollection() public {
        for(uint256 i;i<5;i++) {
            CollectionControls target=CollectionControls(collections()[i]);target.transferOwnership(BOB);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector,address(this)));target.setMintPaused(true);
            vm.prank(BOB);target.setMintPaused(true);require(target.mintPaused());
            (bool denied,)=address(target).call(metadataCalls()[i]);require(!denied);
            vm.prank(BOB);(bool ok,)=address(target).call(metadataCalls()[i]);require(ok);
        }
    }
    function testPauseEmitsStatusEvent() public {
        vm.expectEmit(false,false,false,true,address(land));emit MintPausedChanged(true);
        land.setMintPaused(true);require(land.mintPaused());
    }
    function testCompatibilityCollectionsReceiveControls() public {
        WorldParcelNFT oldLand=new WorldParcelNFT(7,"https://example.com/",address(this));
        AtlasCharacters oldCharacters=new AtlasCharacters(address(this));
        oldLand.setMintPaused(true);oldCharacters.setMintPaused(true);
        vm.expectRevert(CollectionControls.MintingPaused.selector);oldLand.mint(ALICE,742);
        vm.expectRevert(CollectionControls.MintingPaused.selector);oldCharacters.mint(ALICE,1);
        oldLand.setMintPaused(false);oldCharacters.setMintPaused(false);
        oldLand.mint(ALICE,742);oldCharacters.mint(ALICE,1);
        oldLand.setMetadataBaseURI("ipfs://old-land/");equal(oldLand.tokenURI(742),"ipfs://old-land/742.json");
        oldCharacters.setURI("ipfs://old-character.json");equal(oldCharacters.tokenURI(1),"ipfs://old-character.json");
    }
    function equal(string memory a,string memory b) private pure {require(keccak256(bytes(a))==keccak256(bytes(b)));}
}
