// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DoodverseCharacters is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 1000;
    string public constant METADATA_BASE = "https://3dnft.vercel.app/cryptodoodz/metadata/";
    error InvalidCharacterId();
    constructor(address authority) ERC721("Doodverse Characters", "DOODCHAR") Ownable(authority) {}

    function mint(address to, uint256 id) external onlyOwner {
        if (id == 0 || id > MAX_SUPPLY) revert InvalidCharacterId();
        _safeMint(to, id);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        string memory padding = id < 10 ? "000" : id < 100 ? "00" : id < 1000 ? "0" : "";
        return string.concat(METADATA_BASE, padding, Strings.toString(id), ".json");
    }
}
