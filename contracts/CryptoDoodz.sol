// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract CryptoDoodz is ERC721, Ownable2Step, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MAX_PER_WALLET = 5;
    uint256 public totalSupply;
    mapping(address => uint256) public mintedBy;
    bool public mintOpen;
    bool public metadataFrozen;
    string public baseTokenURI;
    event MintOpenChanged(bool open);
    event BaseURIChanged(string uri);
    event MetadataFrozen();
    error MintClosed();
    error InvalidQuantity();
    error WalletLimit();
    error SoldOut();
    error MetadataNotReady();
    error FrozenMetadata();

    constructor(address initialOwner) ERC721("CryptoDoodz", "DOODZ") Ownable(initialOwner) {}

    // Nonpayable: mint price is permanently zero. Gas is paid to the network.
    function mint(uint256 quantity) external nonReentrant {
        if (!mintOpen) revert MintClosed();
        if (quantity == 0 || quantity > MAX_PER_WALLET) revert InvalidQuantity();
        if (mintedBy[msg.sender] + quantity > MAX_PER_WALLET) revert WalletLimit();
        if (totalSupply + quantity > MAX_SUPPLY) revert SoldOut();
        uint256 first = totalSupply + 1;
        mintedBy[msg.sender] += quantity;
        totalSupply += quantity;
        for (uint256 i; i < quantity; ++i) _safeMint(msg.sender, first + i);
    }
    function setMintOpen(bool open) external onlyOwner {
        if (open && bytes(baseTokenURI).length == 0) revert MetadataNotReady();
        mintOpen = open;
        emit MintOpenChanged(open);
    }
    function setBaseURI(string calldata uri) external onlyOwner {
        if (metadataFrozen) revert FrozenMetadata();
        if (bytes(uri).length == 0) revert MetadataNotReady();
        baseTokenURI = uri;
        emit BaseURIChanged(uri);
    }
    function freezeMetadata() external onlyOwner {
        if (metadataFrozen) revert FrozenMetadata();
        if (bytes(baseTokenURI).length == 0) revert MetadataNotReady();
        metadataFrozen = true;
        emit MetadataFrozen();
    }
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory id = Strings.toString(tokenId);
        string memory pad = tokenId < 10 ? "000" : tokenId < 100 ? "00" : tokenId < 1000 ? "0" : "";
        return string.concat(baseTokenURI, pad, id, ".json");
    }
}
