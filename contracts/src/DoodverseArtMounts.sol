// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {DoodverseParcelState} from "./DoodverseParcelState.sol";
import {DoodverseNFTState} from "./DoodverseNFTState.sol";
import {WorldEditionState} from "./WorldEditionState.sol";

/// @notice Presentation anchors for the existing custody contracts. Never holds assets.
/// Anchors belong to an asset at an exact parcel/pose. Returning it to that same
/// pose restores the layout. Wall IDs are stable and never reused by ParcelState.
contract DoodverseArtMounts {
    IERC721 public immutable land;
    DoodverseParcelState public immutable parcels;
    DoodverseNFTState public immutable nfts;
    WorldEditionState public immutable editions;
    struct Mount { bool saved; uint32 wallId; }
    mapping(bytes32 => Mount) private mounts;
    error Unauthorized();
    error AttachmentChanged();
    error InvalidWall();
    event MountSaved(bytes32 indexed key, uint16 indexed parcelId, uint32 wallId);

    constructor(address land_, address parcels_, address nfts_, address editions_) {
        land = IERC721(land_);
        parcels = DoodverseParcelState(parcels_);
        nfts = DoodverseNFTState(nfts_);
        editions = WorldEditionState(editions_);
        require(address(parcels.land()) == land_ && address(nfts.land()) == land_ && address(editions.land()) == land_, "Land mismatch");
    }
    function _save(bytes32 key, uint16 parcel, uint32 wallId) private {
        if (land.ownerOf(parcel) != msg.sender) revert Unauthorized();
        if (wallId != 0) {
            DoodverseParcelState.WorldObject[] memory objects = parcels.getObjects(parcel);
            bool found;
            for (uint256 i; i < objects.length; ++i) {
                if (objects[i].id == wallId && objects[i].objectType == 8) { found = true; break; }
            }
            if (!found) revert InvalidWall();
        }
        mounts[key] = Mount(true, wallId);
        emit MountSaved(key, parcel, wallId);
    }
    function _key721(address collection, uint256 tokenId) private view returns (bytes32 key, uint16 parcel, bytes32 pose) {
        DoodverseNFTState.Attachment memory a = nfts.getAttachment(collection, tokenId);
        if (a.depositor == address(0) || a.location.containerId != 0) revert AttachmentChanged();
        pose = keccak256(abi.encode(a.location));
        return (keccak256(abi.encode(uint8(1), collection, tokenId, pose)), a.location.parcelId, pose);
    }
    function _key1155(uint256 id) private view returns (bytes32 key, uint16 parcel, bytes32 pose) {
        (uint256 storedId,,,,, WorldEditionState.Location memory loc) = editions.attachments(id);
        if (storedId == 0) revert AttachmentChanged();
        pose = keccak256(abi.encode(loc));
        return (keccak256(abi.encode(uint8(2), id, pose)), loc.parcelId, pose);
    }
    function set721(address collection, uint256 tokenId, bytes32 expectedPose, uint32 wallId) external {
        (bytes32 key, uint16 parcel, bytes32 pose) = _key721(collection, tokenId);
        if (pose != expectedPose) revert AttachmentChanged();
        _save(key, parcel, wallId);
    }
    function set1155(uint256 id, bytes32 expectedPose, uint32 wallId) external {
        (bytes32 key, uint16 parcel, bytes32 pose) = _key1155(id);
        if (pose != expectedPose) revert AttachmentChanged();
        _save(key, parcel, wallId);
    }
    function get721(address collection, uint256 tokenId) external view returns (Mount memory) {
        (bytes32 key,,) = _key721(collection, tokenId); return mounts[key];
    }
    function get1155(uint256 id) external view returns (Mount memory) {
        (bytes32 key,,) = _key1155(id); return mounts[key];
    }
}
