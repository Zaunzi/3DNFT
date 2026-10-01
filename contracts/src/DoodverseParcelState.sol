// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice Terrain-anchored scenery and elevated, centimeter-precision buildings to a fixed NFT collection.
contract DoodverseParcelState {
    IERC721 public immutable land;
    uint16 public constant PARCEL_UNITS = 6400;
    uint16 public constant MAX_OBJECTS = 128;
    uint8 public constant SCHEMA_VERSION = 2;

    // One packed slot per object. Types 1-5 derive terrain Y; modular types store signed centimeter Y.
    struct WorldObject { uint32 id; uint8 objectType; uint16 x; uint16 z; uint16 rotation; int16 y; }
    struct Parcel { uint32 nextId; uint32 revision; WorldObject[] objects; }
    mapping(uint256 => Parcel) private parcels;
    error NotParcelOwner();
    error InvalidPlacement();
    error ParcelFull();
    error UnknownObject();
    event ObjectPlaced(uint256 indexed tokenId, uint32 indexed objectId, uint8 objectType, uint16 x, uint16 z, uint16 rotation, int16 y, uint32 revision);
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
        if (objectType == 7 || objectType == 11) return 283;
        if (objectType >= 8 && objectType <= 10) return 201;
        if (objectType == 12) return 45;
        if (objectType == 14) return 142;
        if (objectType == 15) return 224;
        revert InvalidPlacement();
    }
    function placeObject(uint256 tokenId, uint8 objectType, uint16 x, uint16 z, uint16 rotation, int16 y)
        external onlyParcelOwner(tokenId) returns (uint32 id)
    {
        uint16 radius = footprint(objectType);
        if (y < -32000 || y > 32000) revert InvalidPlacement();
        if (objectType < 7 ? y != 0 : rotation % 9000 != 0) revert InvalidPlacement();
        if (x < radius || z < radius || x > PARCEL_UNITS - radius || z > PARCEL_UNITS - radius || rotation >= 36000) revert InvalidPlacement();
        Parcel storage parcel = parcels[tokenId];
        if (parcel.objects.length >= MAX_OBJECTS) revert ParcelFull();
        id = ++parcel.nextId; // Stable IDs are never reused, including after removal.
        parcel.objects.push(WorldObject(id, objectType, x, z, rotation, y));
        emit ObjectPlaced(tokenId, id, objectType, x, z, rotation, y, ++parcel.revision);
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
