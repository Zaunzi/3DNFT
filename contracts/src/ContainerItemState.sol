// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldNFTState} from "./WorldNFTState.sol";
import {AtlasItemTypes} from "./AtlasItems.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Separate ERC1155 custody; never duplicates Phase 3 WorldItemState records.
contract ContainerItemState is ERC1155Holder, ReentrancyGuard {
    WorldNFTState public immutable world;
    IERC1155 public immutable items;
    mapping(uint32 => mapping(uint16 => uint256)) public balances;
    mapping(uint16 => uint256) public escrowed;
    bytes32 private expected;
    event ContainerItemChanged(uint32 indexed containerId, uint16 indexed itemId, uint256 balance);

    constructor(address worldAddress, address itemAddress) {
        require(worldAddress.code.length > 0 && itemAddress.code.length > 0);
        world = WorldNFTState(worldAddress);
        items = IERC1155(itemAddress);
    }

    function authorize(uint32 id) private view returns (uint16 parcel) {
        (uint32 exists, uint16 p,,,,,) = world.containers(id);
        require(exists != 0, "Missing container");
        world.checkOwner(p, msg.sender);
        return p;
    }

    function store(uint32 id, uint16 item, uint256 amount) external nonReentrant {
        uint16 parcel = authorize(id);
        require(
            AtlasItemTypes.valid(item) && amount > 0 && balances[id][item] + amount <= AtlasItemTypes.maxStack(item),
            "Invalid quantity"
        );
        if (balances[id][item] == 0) world.reserveItem(id, true);
        balances[id][item] += amount;
        escrowed[item] += amount;
        expected = keccak256(abi.encode(msg.sender, uint256(item), amount));
        items.safeTransferFrom(msg.sender, address(this), item, amount, "");
        require(expected == bytes32(0));
        world.checkOwner(parcel, msg.sender);
        emit ContainerItemChanged(id, item, balances[id][item]);
    }

    function retrieve(uint32 id, uint16 item, uint256 amount) external nonReentrant {
        authorize(id);
        require(amount > 0 && balances[id][item] >= amount, "Invalid quantity");
        balances[id][item] -= amount;
        escrowed[item] -= amount;
        if (balances[id][item] == 0) world.reserveItem(id, false);
        items.safeTransferFrom(address(this), msg.sender, item, amount, "");
        emit ContainerItemChanged(id, item, balances[id][item]);
    }

    function getBalances(uint32 id) external view returns (uint256[6] memory result) {
        for (uint16 i = 1; i <= 6; ++i) {
            result[i - 1] = balances[id][i];
        }
    }

    function onERC1155Received(address operator, address from, uint256 id, uint256 amount, bytes memory)
        public
        override
        returns (bytes4)
    {
        require(
            msg.sender == address(items) && operator == address(this) && expected != bytes32(0)
                && expected == keccak256(abi.encode(from, id, amount)),
            "Unsolicited deposit"
        );
        expected = bytes32(0);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
        returns (bytes4)
    {
        revert("Batch unsupported");
    }
}
