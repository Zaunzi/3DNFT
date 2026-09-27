// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
/// @notice Schema 1 stores internal Atlas destinations only. Chain/collection are inherited.
contract PortalState {
    IERC721 public immutable land;
    uint8 public constant SCHEMA_VERSION = 1;
    uint16 public constant MAX_PORTALS = 16;
    struct Portal { uint32 id; uint16 destinationTokenId; uint16 x; uint16 z; uint16 rotation; }
    struct Parcel { uint32 nextId; Portal[] portals; }
    mapping(uint256 => Parcel) private parcels;
    error Unauthorized(); error InvalidPortal(); error UnknownPortal();
    event PortalPlaced(uint256 indexed tokenId, uint32 indexed portalId, uint16 destinationTokenId, uint16 x, uint16 z, uint16 rotation);
    event PortalRemoved(uint256 indexed tokenId, uint32 indexed portalId);
    constructor(address landAddress) { require(landAddress.code.length > 0, "Contract required"); land = IERC721(landAddress); }
    function placePortal(uint256 tokenId, uint16 destinationTokenId, uint16 x, uint16 z, uint16 rotation) external returns (uint32 id) {
        if (tokenId >= 5000 || destinationTokenId >= 5000 || x < 200 || z < 200 || x > 6200 || z > 6200 || rotation >= 36000) revert InvalidPortal();
        if (land.ownerOf(tokenId) != msg.sender) revert Unauthorized();
        land.ownerOf(destinationTokenId); // Reverts for an unminted destination.
        Parcel storage parcel = parcels[tokenId];
        if (parcel.portals.length >= MAX_PORTALS) revert InvalidPortal();
        id = ++parcel.nextId; parcel.portals.push(Portal(id, destinationTokenId, x, z, rotation));
        emit PortalPlaced(tokenId, id, destinationTokenId, x, z, rotation);
    }
    function removePortal(uint256 tokenId, uint32 portalId) external {
        if (land.ownerOf(tokenId) != msg.sender) revert Unauthorized();
        Portal[] storage list = parcels[tokenId].portals;
        for (uint256 i; i < list.length; ++i) if (list[i].id == portalId) { list[i] = list[list.length - 1]; list.pop(); emit PortalRemoved(tokenId, portalId); return; }
        revert UnknownPortal();
    }
    function getPortals(uint256 tokenId) external view returns (Portal[] memory) { return parcels[tokenId].portals; }
}
