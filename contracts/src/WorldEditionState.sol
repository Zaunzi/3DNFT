// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice External ERC-1155 editions belong to their parcel while in custody.
contract WorldEditionState is ERC1155Holder, ReentrancyGuard {
    IERC721 public immutable land;
    uint8 public constant SCHEMA_VERSION = 1;
    uint256 public constant MAX_ATTACHMENTS = 64;
    struct Location { uint16 parcelId; uint16 x; uint16 z; uint16 rotation; }
    struct Attachment { uint256 id; address collection; uint256 tokenId; uint256 quantity; address depositor; Location location; }
    uint256 public nextId;
    mapping(uint256 => Attachment) public attachments;
    mapping(uint256 => uint256[]) private parcelIds;
    mapping(uint256 => uint256) private positions;
    mapping(address => mapping(uint256 => uint256)) public escrowed;
    bytes32 private expected;
    error Unauthorized(); error InvalidPlacement(); error InvalidAsset(); error ParcelFull(); error UnknownAttachment(); error UnexpectedTransfer(); error CustodyMismatch();
    event EditionAttached(uint256 indexed id, uint256 indexed parcelId, address indexed collection, uint256 tokenId, uint256 quantity, address depositor, uint16 x, uint16 z, uint16 rotation);
    event EditionMoved(uint256 indexed id, uint256 indexed fromParcel, uint256 indexed toParcel, uint16 x, uint16 z, uint16 rotation);
    event EditionDetached(uint256 indexed id, address indexed recipient);
    constructor(address parcelContract) { require(parcelContract.code.length > 0, "Contract required"); land = IERC721(parcelContract); }
    function _owner(uint256 parcel) private view { if (land.ownerOf(parcel) != msg.sender) revert Unauthorized(); }
    function _location(Location calldata loc) private pure {
        if (loc.parcelId >= 5000 || loc.x < 150 || loc.x > 6250 || loc.z < 150 || loc.z > 6250 || loc.rotation >= 36000) revert InvalidPlacement();
    }
    function _add(uint256 parcel, uint256 id) private {
        if (parcelIds[parcel].length >= MAX_ATTACHMENTS) revert ParcelFull();
        positions[id] = parcelIds[parcel].length; parcelIds[parcel].push(id);
    }
    function _remove(uint256 parcel, uint256 id) private {
        uint256[] storage ids = parcelIds[parcel]; uint256 index = positions[id]; uint256 last = ids[ids.length - 1];
        ids[index] = last; positions[last] = index; ids.pop(); delete positions[id];
    }
    function attach(address collection, uint256 tokenId, uint256 quantity, Location calldata loc) external nonReentrant returns (uint256 id) {
        _location(loc); _owner(loc.parcelId);
        if (quantity == 0 || collection.code.length == 0 || !IERC1155(collection).supportsInterface(type(IERC1155).interfaceId)) revert InvalidAsset();
        IERC1155 token = IERC1155(collection);
        uint256 beforeBalance = token.balanceOf(address(this), tokenId);
        id = ++nextId; _add(loc.parcelId, id);
        attachments[id] = Attachment(id, collection, tokenId, quantity, msg.sender, loc);
        escrowed[collection][tokenId] += quantity;
        expected = keccak256(abi.encode(collection, msg.sender, tokenId, quantity));
        token.safeTransferFrom(msg.sender, address(this), tokenId, quantity, "");
        if (expected != bytes32(0) || token.balanceOf(address(this), tokenId) != beforeBalance + quantity) revert CustodyMismatch();
        _owner(loc.parcelId); // A token callback must not change the authorizing parcel owner.
        emit EditionAttached(id, loc.parcelId, collection, tokenId, quantity, msg.sender, loc.x, loc.z, loc.rotation);
    }
    function move(uint256 id, Location calldata loc) external nonReentrant {
        Attachment storage a = attachments[id]; if (a.id == 0) revert UnknownAttachment();
        _location(loc); _owner(a.location.parcelId); _owner(loc.parcelId);
        uint256 from = a.location.parcelId;
        if (from != loc.parcelId) { _remove(from, id); _add(loc.parcelId, id); }
        a.location = loc; emit EditionMoved(id, from, loc.parcelId, loc.x, loc.z, loc.rotation);
    }
    function detach(uint256 id) external nonReentrant {
        Attachment memory a = attachments[id]; if (a.id == 0) revert UnknownAttachment(); _owner(a.location.parcelId);
        IERC1155 token = IERC1155(a.collection); uint256 beforeBalance = token.balanceOf(address(this), a.tokenId);
        _remove(a.location.parcelId, id); delete attachments[id]; escrowed[a.collection][a.tokenId] -= a.quantity;
        token.safeTransferFrom(address(this), msg.sender, a.tokenId, a.quantity, "");
        if (token.balanceOf(address(this), a.tokenId) != beforeBalance - a.quantity) revert CustodyMismatch();
        emit EditionDetached(id, msg.sender);
    }
    function getAttachments(uint256 parcel) external view returns (Attachment[] memory result) {
        uint256[] storage ids = parcelIds[parcel]; result = new Attachment[](ids.length);
        for (uint256 i; i < ids.length; ++i) result[i] = attachments[ids[i]];
    }
    function onERC1155Received(address operator, address from, uint256 tokenId, uint256 quantity, bytes memory) public override returns (bytes4) {
        if (operator != address(this) || expected == bytes32(0) || expected != keccak256(abi.encode(msg.sender, from, tokenId, quantity))) revert UnexpectedTransfer();
        expected = bytes32(0); return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public pure override returns (bytes4) { revert UnexpectedTransfer(); }
}
