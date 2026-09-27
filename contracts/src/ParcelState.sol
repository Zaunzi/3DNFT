// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice Terrain-anchored, centimeter-precision modifications to a fixed NFT collection.
contract ParcelState {
    IERC721 public immutable land;
    uint16 public constant PARCEL_UNITS = 6400;
    uint16 public constant MAX_OBJECTS = 128;
    uint8 public constant SCHEMA_VERSION = 1;

    // 11 bytes; each array element occupies one storage slot. Y is derived from terrain v1.
    struct WorldObject { uint32 id; uint8 objectType; uint16 x; uint16 z; uint16 rotation; }
    struct Parcel { uint32 nextId; uint32 revision; WorldObject[] objects; }
    mapping(uint256 => Parcel) private parcels;
    error NotParcelOwner();
    error InvalidPlacement();
    error ParcelFull();
    error UnknownObject();
    event ObjectPlaced(uint256 indexed tokenId, uint32 indexed objectId, uint8 objectType, uint16 x, uint16 z, uint16 rotation, uint32 revision);
    event ObjectRemoved(uint256 indexed tokenId, uint32 indexed objectId, uint32 revision);

    constructor(address landAddress) {
        require(landAddress.code.length != 0, "Land must be a contract");
        land = IERC721(landAddress);
    }
    modifier onlyParcelOwner(uint256 tokenId) {
        // Approved operators do not gain build rights; transfers immediately change authorization.
        if (land.ownerOf(tokenId) != msg.sender) revert NotParcelOwner();
        _;
    }
    function footprint(uint8 objectType) public pure returns (uint16) {
        if (objectType == 1) return 142; // 2 x 2 cube, circumscribed radius
        if (objectType == 2) return 361; // 6 x 4 platform
        if (objectType == 3) return 80;
        if (objectType == 4) return 200;
        if (objectType == 5) return 120;
        revert InvalidPlacement();
    }
    function placeObject(uint256 tokenId, uint8 objectType, uint16 x, uint16 z, uint16 rotation)
        external onlyParcelOwner(tokenId) returns (uint32 id)
    {
        uint16 radius = footprint(objectType);
        if (x < radius || z < radius || x > PARCEL_UNITS - radius || z > PARCEL_UNITS - radius || rotation >= 36000) revert InvalidPlacement();
        Parcel storage parcel = parcels[tokenId];
        if (parcel.objects.length >= MAX_OBJECTS) revert ParcelFull();
        id = ++parcel.nextId; // Stable IDs are never reused, including after removal.
        parcel.objects.push(WorldObject(id, objectType, x, z, rotation));
        emit ObjectPlaced(tokenId, id, objectType, x, z, rotation, ++parcel.revision);
    }
    function removeObject(uint256 tokenId, uint32 objectId) external onlyParcelOwner(tokenId) {
        Parcel storage parcel = parcels[tokenId];
        // Bounded scan saves a separate index mapping/storage slot per object.
        // Swap-and-pop has constant storage writes and does not change surviving IDs.
        for (uint256 i; i < parcel.objects.length; ++i) {
            if (parcel.objects[i].id == objectId) {
                uint256 last = parcel.objects.length - 1;
                if (i != last) parcel.objects[i] = parcel.objects[last];
                parcel.objects.pop();
                emit ObjectRemoved(tokenId, objectId, ++parcel.revision);
                return;
            }
        }
        revert UnknownObject();
    }
    function getObjects(uint256 tokenId) external view returns (WorldObject[] memory) { return parcels[tokenId].objects; }
    function revision(uint256 tokenId) external view returns (uint32) { return parcels[tokenId].revision; }
}
