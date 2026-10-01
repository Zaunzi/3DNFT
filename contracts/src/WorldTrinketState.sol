// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/// @notice Land-attached custody. Selling the parcel transfers the claim to its attached items.
contract WorldTrinketState is ERC1155Holder, ReentrancyGuard {
    IERC721 public immutable land;
    IERC1155 public immutable items;
    uint8 public constant SCHEMA_VERSION = 1;
    uint16 public constant MAX_INSTANCES = 64;
    // First six fields fit one slot; quantity uses a second slot.
    struct Instance { address depositor; uint32 id; uint16 itemType; uint16 x; uint16 z; uint16 rotation; uint64 quantity; }
    struct Parcel { uint32 nextId; Instance[] instances; }
    mapping(uint256 => Parcel) private parcels;
    mapping(uint256 => uint256) public escrowed;
    bytes32 private expectedDeposit;
    error Unauthorized(); error InvalidPlacement(); error UnknownInstance(); error ParcelFull(); error UnsolicitedDeposit();
    event ItemPlaced(uint256 indexed tokenId, uint32 indexed instanceId, address indexed depositor, uint16 itemType, uint64 quantity, uint16 x, uint16 z, uint16 rotation);
    event ItemPickedUp(uint256 indexed tokenId, uint32 indexed instanceId, address indexed recipient);
    constructor(address landAddress, address itemsAddress) {
        require(landAddress.code.length > 0 && itemsAddress.code.length > 0, "Contract required");
        land = IERC721(landAddress); items = IERC1155(itemsAddress);
    }
    function placeItem(uint256 tokenId, uint16 itemType, uint64 quantity, uint16 x, uint16 z, uint16 rotation) external nonReentrant returns (uint32 id) {
        if (tokenId >= 5000 || (itemType < 1 || itemType > 5) || quantity != 1 || x < 200 || z < 200 || x > 6200 || z > 6200 || rotation >= 36000) revert InvalidPlacement();
        if (land.ownerOf(tokenId) != msg.sender) revert Unauthorized();
        Parcel storage parcel = parcels[tokenId];
        if (parcel.instances.length >= MAX_INSTANCES) revert ParcelFull();
        id = ++parcel.nextId;
        parcel.instances.push(Instance(msg.sender, id, itemType, x, z, rotation, quantity));
        escrowed[itemType] += quantity;
        expectedDeposit = keccak256(abi.encode(msg.sender, uint256(itemType), uint256(quantity)));
        items.safeTransferFrom(msg.sender, address(this), itemType, quantity, "");
        require(expectedDeposit == bytes32(0), "Missing receiver callback");
        emit ItemPlaced(tokenId, id, msg.sender, itemType, quantity, x, z, rotation);
    }
    function pickupItem(uint256 tokenId, uint32 instanceId) external nonReentrant { _returnItem(tokenId, instanceId); }
    /// @notice Clearing an attached item returns it to the current parcel owner.
    function evictItem(uint256 tokenId, uint32 instanceId) external nonReentrant {
        if (land.ownerOf(tokenId) != msg.sender) revert Unauthorized();
        _returnItem(tokenId, instanceId);
    }
    function _returnItem(uint256 tokenId, uint32 instanceId) private {
        Instance[] storage list = parcels[tokenId].instances;
        for (uint256 i; i < list.length; ++i) if (list[i].id == instanceId) {
            Instance memory instance = list[i];
            address recipient = land.ownerOf(tokenId);
            if (recipient != msg.sender) revert Unauthorized();
            list[i] = list[list.length - 1]; list.pop();
            escrowed[instance.itemType] -= instance.quantity;
            // Effects before callback, plus a guard: failed/reentrant receivers cannot duplicate claims.
            items.safeTransferFrom(address(this), recipient, instance.itemType, instance.quantity, "");
            emit ItemPickedUp(tokenId, instanceId, recipient); return;
        }
        revert UnknownInstance();
    }
    function getItems(uint256 tokenId) external view returns (Instance[] memory) { return parcels[tokenId].instances; }
    function onERC1155Received(address operator, address from, uint256 id, uint256 quantity, bytes memory) public override returns (bytes4) {
        if (msg.sender != address(items) || operator != address(this) || expectedDeposit == bytes32(0) || expectedDeposit != keccak256(abi.encode(from, id, quantity))) revert UnsolicitedDeposit();
        expectedDeposit = bytes32(0);
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public pure override returns (bytes4) { revert UnsolicitedDeposit(); }
}

