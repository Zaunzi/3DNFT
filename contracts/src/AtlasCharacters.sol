// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {CollectionControls} from "./CollectionControls.sol";

contract AtlasCharacters is ERC721, CollectionControls {
    string public metadataURI = 'data:application/json;utf8,{"name":"Atlas Character","description":"A static Atlas character."}';
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
    function setURI(string calldata value) external onlyOwner {
        if (bytes(value).length == 0) revert InvalidMetadataURI();
        metadataURI = value;
        emit MetadataURIUpdated(value);
        emit BatchMetadataUpdate(0, type(uint256).max);
    }
    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0x49064906 || super.supportsInterface(id);
    }
    constructor(address authority) ERC721("Atlas Characters", "ATLASCHAR") CollectionControls(authority) {}

    function mint(address to, uint256 id) external onlyOwner whenMintingOpen {
        _safeMint(to, id);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return metadataURI;
    }
}
