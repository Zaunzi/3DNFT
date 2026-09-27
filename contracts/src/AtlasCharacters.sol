// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AtlasCharacters is ERC721, Ownable {
    constructor(address authority) ERC721("Atlas Characters", "ATLASCHAR") Ownable(authority) {}

    function mint(address to, uint256 id) external onlyOwner {
        _safeMint(to, id);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return 'data:application/json;utf8,{"name":"Atlas Character","description":"A static Atlas character."}';
    }
}
