// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice CryptoDoodz equipment. Item 1 is reserved by convention for the DJ board.
/// Owner distributes editions; no public sale or payment logic is enabled.
contract CryptoDoodzItems is ERC1155Supply, Ownable2Step {
    string public constant name = "CryptoDoodz Items";
    string public constant symbol = "DOODZITEM";
    mapping(uint256 => uint256) public maxSupply;
    mapping(uint256 => string) private itemURIs;
    mapping(uint256 => bool) public metadataFrozen;
    event ItemCreated(uint256 indexed id, uint256 cap);
    event ItemMetadataFrozen(uint256 indexed id);
    error InvalidItem();
    error InvalidQuantity();
    error SupplyExceeded();
    error FrozenMetadata();
    constructor(address initialOwner) ERC1155("") Ownable(initialOwner) {}
    function createItem(uint256 id, uint256 cap, string calldata metadataURI) external onlyOwner {
        if (id == 0 || cap == 0 || maxSupply[id] != 0 || bytes(metadataURI).length == 0) revert InvalidItem();
        maxSupply[id] = cap;
        itemURIs[id] = metadataURI;
        emit ItemCreated(id, cap);
        emit URI(metadataURI, id);
    }
    function uri(uint256 id) public view override returns (string memory) {
        if (maxSupply[id] == 0) revert InvalidItem();
        return itemURIs[id];
    }
    function mint(address recipient, uint256 id, uint256 quantity, bytes calldata data) external onlyOwner {
        if (maxSupply[id] == 0) revert InvalidItem();
        if (quantity == 0) revert InvalidQuantity();
        if (totalSupply(id) + quantity > maxSupply[id]) revert SupplyExceeded();
        _mint(recipient, id, quantity, data);
    }
    function setItemURI(uint256 id, string calldata metadataURI) external onlyOwner {
        if (maxSupply[id] == 0 || bytes(metadataURI).length == 0) revert InvalidItem();
        if (metadataFrozen[id]) revert FrozenMetadata();
        itemURIs[id] = metadataURI;
        emit URI(metadataURI, id);
    }
    function freezeItemMetadata(uint256 id) external onlyOwner {
        if (maxSupply[id] == 0) revert InvalidItem();
        if (metadataFrozen[id]) revert FrozenMetadata();
        metadataFrozen[id] = true;
        emit ItemMetadataFrozen(id);
    }
}
