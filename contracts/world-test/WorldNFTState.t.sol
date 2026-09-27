// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldNFTState} from "../src/WorldNFTState.sol";
import {ContainerItemState} from "../src/ContainerItemState.sol";
import {AtlasCharacters} from "../src/AtlasCharacters.sol";
import {AtlasItems} from "../src/AtlasItems.sol";
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface NFTVm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert() external;
    function warp(uint256) external;
}

contract ReenteringOwner is IERC721Receiver {
    WorldNFTState public state;
    AtlasCharacters public nft;
    bool public reject;

    constructor(WorldNFTState s, AtlasCharacters n) {
        state = s;
        nft = n;
    }

    function attach() external {
        nft.approve(address(state), 1);
        state.attach(address(nft), 1, WorldNFTState.Location(742, 0, 3200, 3200, 0));
    }

    function withdraw(bool rejection) external {
        reject = rejection;
        state.detach(address(nft), 1);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (reject) revert("Receiver rejection");
        if (msg.sender == address(nft) && nft.ownerOf(1) == address(this)) {
            try state.detach(address(nft), 1) {
                revert("Reentrancy succeeded");
            }
                catch {}
        }
        return this.onERC721Received.selector;
    }
}

contract WorldNFTStateTest {
    NFTVm constant vm = NFTVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    WorldParcelNFT land;
    AtlasCharacters nft;
    AtlasItems items;
    WorldNFTState state;
    ContainerItemState storageItems;

    function setUp() public {
        land = new WorldParcelNFT(7422026, "https://world.example/nft/", address(this));
        nft = new AtlasCharacters(address(this));
        items = new AtlasItems(address(this), "ipfs://items/{id}");
        state = new WorldNFTState(address(land), address(this));
        storageItems = new ContainerItemState(address(state), address(items));
        state.bindContainerItems(address(storageItems));
        land.mint(ALICE, 742);
        land.mint(ALICE, 743);
        nft.mint(ALICE, 1);
        items.mint(ALICE, 3, 20);
        items.mint(ALICE, 4, 1);
    }

    function loc(uint16 parcel, uint32 container) private pure returns (WorldNFTState.Location memory) {
        return WorldNFTState.Location(parcel, container, container == 0 ? 3200 : 0, container == 0 ? 3200 : 0, 0);
    }

    function attach() private {
        vm.prank(ALICE);
        nft.approve(address(state), 1);
        vm.prank(ALICE);
        state.attach(address(nft), 1, loc(742, 0));
    }

    function testAttachmentTransferAndWithdrawal() public {
        attach();
        require(nft.ownerOf(1) == address(state));
        require(state.controller(address(nft), 1) == ALICE);
        bytes32 beforeLocation = keccak256(abi.encode(state.getAttachment(address(nft), 1)));
        vm.prank(ALICE);
        land.transferFrom(ALICE, BOB, 742);
        require(keccak256(abi.encode(state.getAttachment(address(nft), 1))) == beforeLocation);
        require(state.controller(address(nft), 1) == BOB);
        vm.prank(ALICE);
        vm.expectRevert();
        state.detach(address(nft), 1);
        vm.prank(BOB);
        state.detach(address(nft), 1);
        require(nft.ownerOf(1) == BOB && state.getAttachments(742).length == 0);
        vm.prank(BOB);
        vm.expectRevert();
        state.detach(address(nft), 1);
    }

    function testUnauthorizedDuplicateAndApprovalAtomicity() public {
        vm.prank(ALICE);
        vm.expectRevert();
        state.attach(address(nft), 1, loc(742, 0));
        require(state.getAttachments(742).length == 0 && nft.ownerOf(1) == ALICE);
        vm.prank(BOB);
        vm.expectRevert();
        state.attach(address(nft), 1, loc(742, 0));
        attach();
        vm.prank(ALICE);
        vm.expectRevert();
        state.attach(address(nft), 1, loc(742, 0));
        vm.prank(BOB);
        vm.expectRevert();
        state.move(address(nft), 1, loc(743, 0));
        require(state.getAttachments(742).length == 1);
    }

    function testContainersCapacityAndSale() public {
        vm.prank(ALICE);
        uint32 c = state.createContainer(742, 3200, 3200, 0, 2);
        attach();
        vm.prank(ALICE);
        state.move(address(nft), 1, loc(742, c));
        vm.prank(ALICE);
        items.setApprovalForAll(address(storageItems), true);
        vm.prank(ALICE);
        storageItems.store(c, 3, 12);
        vm.prank(ALICE);
        vm.expectRevert();
        storageItems.store(c, 4, 1);
        vm.prank(ALICE);
        vm.expectRevert();
        state.removeContainer(c);
        require(state.getAttachment(address(nft), 1).location.containerId == c);
        vm.prank(ALICE);
        land.transferFrom(ALICE, BOB, 742);
        vm.prank(ALICE);
        vm.expectRevert();
        storageItems.retrieve(c, 3, 12);
        vm.prank(BOB);
        state.move(address(nft), 1, loc(742, 0));
        vm.prank(BOB);
        storageItems.retrieve(c, 3, 12);
        vm.prank(BOB);
        state.removeContainer(c);
        require(items.balanceOf(BOB, 3) == 12 && items.balanceOf(ALICE, 3) == 8);
        require(nft.ownerOf(1) == address(state));
        require(state.getAttachments(742).length == 1);
        vm.prank(BOB);
        state.detach(address(nft), 1);
        require(nft.ownerOf(1) == BOB);
    }

    function testWalletDirectToContainerAndParcelMovement() public {
        vm.prank(ALICE);
        uint32 c = state.createContainer(743, 3200, 3200, 0, 1);
        vm.prank(ALICE);
        nft.approve(address(state), 1);
        vm.prank(ALICE);
        state.attach(address(nft), 1, loc(743, c));
        require(state.getAttachments(743).length == 1);
        vm.prank(ALICE);
        state.move(address(nft), 1, loc(742, 0));
        require(state.getAttachments(743).length == 0 && state.getAttachments(742).length == 1);
        vm.prank(ALICE);
        state.removeContainer(c);
    }

    function testSafeDirectRejectUnsafeRecoveryOnlyUnregistered() public {
        vm.prank(ALICE);
        vm.expectRevert();
        nft.safeTransferFrom(ALICE, address(state), 1);
        require(nft.ownerOf(1) == ALICE);
        vm.prank(ALICE);
        nft.transferFrom(ALICE, address(state), 1);
        vm.prank(BOB);
        vm.expectRevert();
        state.scheduleRescue(address(nft), 1, BOB);
        state.scheduleRescue(address(nft), 1, ALICE);
        vm.expectRevert();
        state.executeRescue(address(nft), 1);
        vm.warp(block.timestamp + 7 days);
        state.executeRescue(address(nft), 1);
        require(nft.ownerOf(1) == ALICE);
        attach();
        vm.expectRevert();
        state.scheduleRescue(address(nft), 1, BOB);
    }

    function testRejectAtlasLandAndWrongContainerParcel() public {
        vm.prank(ALICE);
        land.approve(address(state), 743);
        vm.prank(ALICE);
        vm.expectRevert();
        state.attach(address(land), 743, loc(742, 0));
        vm.prank(ALICE);
        uint32 c = state.createContainer(743, 3200, 3200, 0, 1);
        vm.prank(ALICE);
        nft.approve(address(state), 1);
        vm.prank(ALICE);
        vm.expectRevert();
        state.attach(address(nft), 1, loc(742, c));
        require(nft.ownerOf(1) == ALICE);
    }

    function testReceiverRejectionAndReentrancy() public {
        ReenteringOwner receiver = new ReenteringOwner(state, nft);
        vm.prank(ALICE);
        land.transferFrom(ALICE, address(receiver), 742);
        vm.prank(ALICE);
        nft.transferFrom(ALICE, address(receiver), 1);
        receiver.attach();
        vm.expectRevert();
        receiver.withdraw(true);
        require(nft.ownerOf(1) == address(state) && state.getAttachments(742).length == 1);
        receiver.withdraw(false);
        require(nft.ownerOf(1) == address(receiver) && state.getAttachments(742).length == 0);
    }

    function testDoorRequirements() public {
        vm.prank(ALICE);
        state.createDoor(742, 3200, 3200, 0, 1, address(items), 4, 1);
        require(state.canOpen(742, 1, ALICE) && !state.canOpen(742, 1, BOB));
        require(items.balanceOf(ALICE, 4) == 1);
        vm.prank(ALICE);
        state.createDoor(742, 3200, 3200, 0, 2, address(nft), 1, 1);
        require(state.canOpen(742, 2, ALICE));
        attach();
        require(!state.canOpen(742, 2, ALICE));
    }

    function testFuzzCoordinates(uint16 x, uint16 z, uint16 rotation) public {
        vm.prank(ALICE);
        nft.approve(address(state), 1);
        bool valid = x >= 150 && x <= 6250 && z >= 150 && z <= 6250 && rotation < 36000;
        vm.prank(ALICE);
        if (!valid) vm.expectRevert();
        state.attach(address(nft), 1, WorldNFTState.Location(742, 0, x, z, rotation));
        require(nft.ownerOf(1) == (valid ? address(state) : ALICE));
    }

    function testFuzzMovementAndSale(uint16 rawParcel, uint256 id, uint32 wrongContainer, bool inside) public {
        uint16 parcel = uint16(uint256(rawParcel) % 5000);
        if (parcel != 742 && parcel != 743) land.mint(ALICE, parcel);
        if (id != 1) nft.mint(ALICE, id);
        vm.prank(ALICE);
        uint32 c = state.createContainer(parcel, 3200, 3200, 0, 2);
        vm.prank(ALICE);
        nft.approve(address(state), id);
        vm.prank(ALICE);
        state.attach(address(nft), id, loc(parcel, inside ? c : 0));
        if (wrongContainer != 0 && wrongContainer != c) {
            vm.prank(ALICE);
            vm.expectRevert();
            state.move(address(nft), id, loc(parcel, wrongContainer));
        }
        vm.prank(ALICE);
        state.move(address(nft), id, loc(743, 0));
        vm.prank(ALICE);
        land.transferFrom(ALICE, BOB, 743);
        vm.prank(ALICE);
        vm.expectRevert();
        state.detach(address(nft), id);
        vm.prank(BOB);
        state.detach(address(nft), id);
        require(nft.ownerOf(id) == BOB);
    }
}
