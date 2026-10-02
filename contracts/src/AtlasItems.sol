// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {CollectionControls} from "./CollectionControls.sol";

library AtlasItemTypes {
    uint16 internal constant STONE = 1;
    uint16 internal constant WOOD = 2;
    uint16 internal constant CRYSTAL = 3;
    uint16 internal constant KEY = 4;
    uint16 internal constant LANTERN = 5;
    uint16 internal constant PORTAL_CORE = 6;
    function valid(uint256 id) internal pure returns (bool) { return id >= STONE && id <= PORTAL_CORE; }
    function maxStack(uint256 id) internal pure returns (uint64) { return id <= CRYSTAL ? 1_000_000 : 1; }
}

/// @notice Controlled development distribution. Only the owner can create supply.
contract AtlasItems is ERC1155, CollectionControls {
    uint8 public constant REGISTRY_VERSION = 1;
    /// @notice Standard ERC-1155 URI template, including optional {id} substitution.
    function setURI(string calldata value) external onlyOwner {
        if (bytes(value).length == 0) revert InvalidMetadataURI();
        _setURI(value);
        emit MetadataURIUpdated(value);
        for (uint256 id = 1; id <= AtlasItemTypes.PORTAL_CORE; ++id) emit URI(value, id);
    }
    constructor(address authority, string memory metadataURI) ERC1155(metadataURI) CollectionControls(authority) {}
    function mint(address recipient, uint256 itemId, uint256 quantity) external onlyOwner whenMintingOpen {
        require(AtlasItemTypes.valid(itemId) && quantity > 0, "Invalid item/quantity");
        _mint(recipient, itemId, quantity, "");
    }
}
