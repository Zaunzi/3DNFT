// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Local-chain NFT custody and one-level container locations. No NFT hierarchy recursion.
contract WorldNFTState is IERC721Receiver, ReentrancyGuard, Ownable {
    IERC721 public immutable land;
    uint8 public constant SCHEMA_VERSION = 1;

    struct Location {
        uint16 parcelId;
        uint32 containerId;
        uint16 x;
        uint16 z;
        uint16 rotation;
    }

    struct Attachment {
        address collection;
        uint256 tokenId;
        address depositor;
        Location location;
    }

    struct Container {
        uint32 id;
        uint16 parcelId;
        uint16 x;
        uint16 z;
        uint16 rotation;
        uint8 capacity;
        uint8 occupied;
    }

    // CHECK_ONLY requirements. kind 1 = ERC1155 balance, kind 2 = exact ERC721 owner.
    struct Door {
        uint32 id;
        uint16 parcelId;
        uint16 x;
        uint16 z;
        uint16 rotation;
        uint8 kind;
        address collection;
        uint256 tokenId;
        uint256 minimum;
    }
    mapping(bytes32 => Attachment) private attached;
    mapping(uint256 => bytes32[]) private parcelAssets;
    mapping(uint32 => Container) public containers;
    mapping(uint256 => uint32[]) private parcelContainers;
    mapping(uint256 => Door[]) private doors;
    uint32 private nextContainer;
    uint32 private nextDoor;
    address public containerItems;
    bytes32 private expected;

    struct Rescue {
        address recipient;
        uint64 afterTime;
    }
    mapping(bytes32 => Rescue) public rescues;
    error Unauthorized();
    error InvalidLocation();
    error Missing();
    error Occupied();
    error InvalidAsset();
    event Attached(address indexed collection, uint256 indexed tokenId, address depositor, Location location);
    event Moved(address indexed collection, uint256 indexed tokenId, Location location);
    event Detached(address indexed collection, uint256 indexed tokenId, address recipient);
    event ContainerChanged(uint32 indexed id, uint16 indexed parcelId, bool removed);
    event DoorChanged(uint32 indexed id, uint16 indexed parcelId, bool removed);
    event RescueScheduled(address indexed collection, uint256 indexed tokenId, address recipient, uint64 afterTime);
    event Rescued(address indexed collection, uint256 indexed tokenId, address recipient);

    constructor(address landAddress, address recoveryAuthority) Ownable(recoveryAuthority) {
        require(landAddress.code.length > 0);
        land = IERC721(landAddress);
    }

    function key(address collection, uint256 id) public pure returns (bytes32) {
        return keccak256(abi.encode(collection, id));
    }

    function checkOwner(uint256 parcel, address account) public view {
        if (parcel >= 5000 || land.ownerOf(parcel) != account) revert Unauthorized();
    }

    function bounds(uint16 x, uint16 z, uint16 rotation) public pure {
        if (x < 150 || z < 150 || x > 6250 || z > 6250 || rotation >= 36000) revert InvalidLocation();
    }

    function validate(Location memory loc) private view {
        checkOwner(loc.parcelId, msg.sender);
        if (loc.containerId == 0) {
            bounds(loc.x, loc.z, loc.rotation);
        } else {
            Container memory c = containers[loc.containerId];
            if (c.id == 0 || c.parcelId != loc.parcelId || loc.x != 0 || loc.z != 0 || loc.rotation != 0) revert InvalidLocation();
        }
    }

    function reserve(uint32 id, bool add) private {
        if (id == 0) return;
        Container storage c = containers[id];
        if (c.id == 0) revert Missing();
        if (add) {
            if (c.occupied >= c.capacity) revert Occupied();
            ++c.occupied;
        } else {
            --c.occupied;
        }
    }

    /// @notice Bind once; cannot replace a custody contract after deployment.
    function bindContainerItems(address custody) external onlyOwner {
        require(containerItems == address(0) && custody.code.length > 0);
        containerItems = custody;
    }

    function reserveItem(uint32 id, bool add) external {
        if (msg.sender != containerItems) revert Unauthorized();
        reserve(id, add);
    }

    function createContainer(uint16 parcel, uint16 x, uint16 z, uint16 rotation, uint8 capacity)
        external
        nonReentrant
        returns (uint32 id)
    {
        checkOwner(parcel, msg.sender);
        bounds(x, z, rotation);
        if (capacity == 0 || capacity > 32 || parcelContainers[parcel].length >= 32) revert InvalidLocation();
        id = ++nextContainer;
        containers[id] = Container(id, parcel, x, z, rotation, capacity, 0);
        parcelContainers[parcel].push(id);
        emit ContainerChanged(id, parcel, false);
    }

    function removeContainer(uint32 id) external nonReentrant {
        Container memory c = containers[id];
        if (c.id == 0) revert Missing();
        checkOwner(c.parcelId, msg.sender);
        if (c.occupied != 0) revert Occupied();
        uint32[] storage list = parcelContainers[c.parcelId];
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == id) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
        delete containers[id];
        emit ContainerChanged(id, c.parcelId, true);
    }

    function getContainers(uint256 parcel) external view returns (Container[] memory result) {
        uint32[] storage ids = parcelContainers[parcel];
        result = new Container[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            result[i] = containers[ids[i]];
        }
    }

    function getAttachment(address collection, uint256 id) external view returns (Attachment memory) {
        return attached[key(collection, id)];
    }

    function getAttachments(uint256 parcel) external view returns (Attachment[] memory result) {
        bytes32[] storage ids = parcelAssets[parcel];
        result = new Attachment[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            result[i] = attached[ids[i]];
        }
    }

    function controller(address collection, uint256 id) external view returns (address) {
        Attachment memory a = attached[key(collection, id)];
        if (a.collection == address(0)) revert Missing();
        return land.ownerOf(a.location.parcelId);
    }

    function attach(address collection, uint256 id, Location calldata loc) external nonReentrant {
        validate(loc);
        bytes32 k = key(collection, id);
        // Attaching Atlas land could make its controlling owner the escrow itself and strand a hierarchy.
        if (
            collection == address(land) || collection == address(this) || attached[k].collection != address(0)
                || IERC721(collection).ownerOf(id) != msg.sender
        ) revert InvalidAsset();
        if (parcelAssets[loc.parcelId].length >= 64) revert Occupied();
        reserve(loc.containerId, true);
        attached[k] = Attachment(collection, id, msg.sender, loc);
        parcelAssets[loc.parcelId].push(k);
        expected = keccak256(abi.encode(collection, id, msg.sender));
        IERC721(collection).safeTransferFrom(msg.sender, address(this), id);
        if (expected != bytes32(0) || IERC721(collection).ownerOf(id) != address(this)) revert InvalidAsset();
        checkOwner(loc.parcelId, msg.sender);
        delete rescues[k];
        emit Attached(collection, id, msg.sender, loc);
    }

    function erase(uint16 parcel, bytes32 k) private {
        bytes32[] storage list = parcelAssets[parcel];
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == k) {
                list[i] = list[list.length - 1];
                list.pop();
                return;
            }
        }
        revert Missing();
    }

    function move(address collection, uint256 id, Location calldata loc) external nonReentrant {
        bytes32 k = key(collection, id);
        Attachment storage a = attached[k];
        if (a.collection == address(0)) revert Missing();
        checkOwner(a.location.parcelId, msg.sender);
        validate(loc);
        if (IERC721(collection).ownerOf(id) != address(this)) revert InvalidAsset();
        reserve(a.location.containerId, false);
        reserve(loc.containerId, true);
        if (a.location.parcelId != loc.parcelId) {
            if (parcelAssets[loc.parcelId].length >= 64) revert Occupied();
            erase(a.location.parcelId, k);
            parcelAssets[loc.parcelId].push(k);
        }
        a.location = loc;
        emit Moved(collection, id, loc);
    }

    function detach(address collection, uint256 id) external nonReentrant {
        bytes32 k = key(collection, id);
        Attachment memory a = attached[k];
        if (a.collection == address(0)) revert Missing();
        checkOwner(a.location.parcelId, msg.sender);
        reserve(a.location.containerId, false);
        erase(a.location.parcelId, k);
        delete attached[k];
        IERC721(collection).safeTransferFrom(address(this), msg.sender, id);
        emit Detached(collection, id, msg.sender);
    }

    function onERC721Received(address operator, address from, uint256 id, bytes calldata) external returns (bytes4) {
        if (
            operator != address(this) || expected == bytes32(0)
                || expected != keccak256(abi.encode(msg.sender, id, from))
        ) {
            revert InvalidAsset();
        }
        expected = bytes32(0);
        return this.onERC721Received.selector;
    }

    // Unsafe transferFrom has no callback/provable depositor. Recovery needs offchain evidence and a trusted authority.
    function scheduleRescue(address collection, uint256 id, address recipient) external onlyOwner nonReentrant {
        bytes32 k = key(collection, id);
        if (
            attached[k].collection != address(0) || IERC721(collection).ownerOf(id) != address(this)
                || recipient == address(0) || recipient == address(this)
        ) revert InvalidAsset();
        uint64 when = uint64(block.timestamp + 7 days);
        rescues[k] = Rescue(recipient, when);
        emit RescueScheduled(collection, id, recipient, when);
    }

    function executeRescue(address collection, uint256 id) external onlyOwner nonReentrant {
        bytes32 k = key(collection, id);
        Rescue memory r = rescues[k];
        if (r.afterTime == 0 || block.timestamp < r.afterTime || attached[k].collection != address(0)) revert InvalidAsset();
        delete rescues[k];
        IERC721(collection).safeTransferFrom(address(this), r.recipient, id);
        emit Rescued(collection, id, r.recipient);
    }

    function createDoor(
        uint16 parcel,
        uint16 x,
        uint16 z,
        uint16 rotation,
        uint8 kind,
        address collection,
        uint256 tokenId,
        uint256 minimum
    ) external nonReentrant {
        checkOwner(parcel, msg.sender);
        bounds(x, z, rotation);
        if ((kind != 1 && kind != 2) || collection.code.length == 0 || minimum == 0 || doors[parcel].length >= 32) revert InvalidAsset();
        uint32 id = ++nextDoor;
        doors[parcel].push(Door(id, parcel, x, z, rotation, kind, collection, tokenId, minimum));
        emit DoorChanged(id, parcel, false);
    }

    function getDoors(uint256 parcel) external view returns (Door[] memory) {
        return doors[parcel];
    }

    function removeDoor(uint16 parcel, uint32 id) external nonReentrant {
        checkOwner(parcel, msg.sender);
        Door[] storage list = doors[parcel];
        for (uint256 i; i < list.length; ++i) {
            if (list[i].id == id) {
                list[i] = list[list.length - 1];
                list.pop();
                emit DoorChanged(id, parcel, true);
                return;
            }
        }
        revert Missing();
    }

    function canOpen(uint16 parcel, uint32 id, address account) external view returns (bool) {
        if (account == address(0)) return false;
        Door[] storage list = doors[parcel];
        for (uint256 i; i < list.length; ++i) {
            if (list[i].id == id) {
                Door memory d = list[i];
                if (d.kind == 1) {
                    try IERC1155(d.collection).balanceOf(account, d.tokenId) returns (uint256 balance) {
                        return balance >= d.minimum;
                    }
                        catch {
                        return false;
                    }
                }
                try IERC721(d.collection).ownerOf(d.tokenId) returns (address holder) {
                    return holder == account;
                }
                    catch {
                    return false;
                }
            }
        }
        return false;
    }
}
