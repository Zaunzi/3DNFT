// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CollectionControls} from "./CollectionControls.sol";

contract DoodverseCharacters is ERC721, CollectionControls, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 5000;
    string public METADATA_BASE = "https://atlas-mu-lime.vercel.app/cryptodoodz/metadata/";
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
    function setMetadataBaseURI(string calldata value) external onlyOwner {
        _validateMetadataBaseURI(value);
        METADATA_BASE = value;
        emit MetadataURIUpdated(value);
        if (totalSupply != 0) emit BatchMetadataUpdate(1, totalSupply);
    }
    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0x49064906 || super.supportsInterface(id);
    }
    error InvalidCharacterId();
    constructor(address authority) ERC721("Doodverse Characters", "DOODCHAR") CollectionControls(authority) {}

    uint256 public constant MAX_PER_WALLET = 5;
    bool public constant PUBLIC_MINT = true;
    mapping(address => uint256) public mintedBy;
    uint256 public totalSupply;
    error InvalidQuantity(); error WalletMintLimit(); error SoldOut();
    /// @notice Free public mint, sequential IDs 1..5000. Transfers never reset allowance.
    function mint(uint256 quantity) external whenMintingOpen nonReentrant {
        if(quantity==0 || quantity>MAX_PER_WALLET) revert InvalidQuantity();
        if(mintedBy[msg.sender]+quantity>MAX_PER_WALLET) revert WalletMintLimit();
        if(totalSupply+quantity>MAX_SUPPLY) revert SoldOut();
        uint256 first=totalSupply+1;
        mintedBy[msg.sender]+=quantity;totalSupply+=quantity;
        for(uint256 i;i<quantity;++i) _safeMint(msg.sender,first+i);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        string memory padding = id < 10 ? "000" : id < 100 ? "00" : id < 1000 ? "0" : "";
        return string.concat(METADATA_BASE, padding, Strings.toString(id), ".json");
    }
}
