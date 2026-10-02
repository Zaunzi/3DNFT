// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {CollectionControls} from "./CollectionControls.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Version 1 topology and seed are canonical; the runtime renders them.
contract WorldParcelNFT is ERC721, CollectionControls {
    using Strings for uint256;
    uint256 public constant WORLD_WIDTH = 100;
    uint256 public constant WORLD_DEPTH = 50;
    uint256 public constant MAX_SUPPLY = WORLD_WIDTH * WORLD_DEPTH;
    uint256 public constant PARCEL_SIZE = 64;
    uint32 public constant GENERATOR_VERSION = 1;
    uint256 public immutable collectionSeed;
    string public runtimeURL;
    string public metadataBaseURI;
    event RuntimeURLUpdated(string runtimeURL);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    /// @notice Nonempty prefixes resolve <tokenId>.json; empty restores generated metadata.
    function setMetadataBaseURI(string calldata value) external onlyOwner {
        if (bytes(value).length != 0) _validateMetadataBaseURI(value);
        metadataBaseURI = value;
        emit MetadataURIUpdated(value);
        emit BatchMetadataUpdate(0, MAX_SUPPLY - 1);
    }
    function setRuntimeURL(string calldata value) external onlyOwner {
        _setRuntimeURL(value);
        emit BatchMetadataUpdate(0, MAX_SUPPLY - 1);
    }
    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0x49064906 || super.supportsInterface(id);
    }
    struct ParcelState { uint32 version; }
    mapping(uint256 => ParcelState) public parcelState;
    error InvalidTokenId();
    error InvalidRuntimeURL();

    /// @param runtime Base HTTPS URL ending in '/', without a query or fragment.
    constructor(uint256 seed, string memory runtime, address initialOwner)
        ERC721("World Parcel", "PLACE") CollectionControls(initialOwner)
    {
        collectionSeed = seed;
        _setRuntimeURL(runtime);
    }
    function _setRuntimeURL(string memory runtime) private {
        bytes memory b = bytes(runtime);
        if (b.length < 10 || b[b.length - 1] != '/' || keccak256(bytes(_prefix(runtime))) != keccak256("https://")) revert InvalidRuntimeURL();
        for (uint256 i; i < b.length; ++i) {
            bytes1 ch = b[i];
            if (uint8(ch) < 33 || uint8(ch) > 126 || ch == '"' || ch == '\\' || ch == '?' || ch == '#') revert InvalidRuntimeURL();
        }
        runtimeURL = runtime;
        emit RuntimeURLUpdated(runtime);
    }
    function _prefix(string memory value) private pure returns (string memory) {
        bytes memory result = new bytes(8);
        for (uint256 i; i < 8; ++i) result[i] = bytes(value)[i];
        return string(result);
    }
    function mint(address recipient, uint256 tokenId) external onlyOwner whenMintingOpen {
        if (tokenId >= MAX_SUPPLY) revert InvalidTokenId();
        _safeMint(recipient, tokenId);
    }
    function tokenIdToCoordinate(uint256 tokenId) public pure returns (uint256 x, uint256 z) {
        if (tokenId >= MAX_SUPPLY) revert InvalidTokenId();
        return (tokenId % WORLD_WIDTH, tokenId / WORLD_WIDTH);
    }
    function coordinateToTokenId(uint256 x, uint256 z) external pure returns (uint256) {
        if (x >= WORLD_WIDTH || z >= WORLD_DEPTH) revert InvalidTokenId();
        return z * WORLD_WIDTH + x;
    }
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (bytes(metadataBaseURI).length != 0) return string.concat(metadataBaseURI, tokenId.toString(), ".json");
        (uint256 x, uint256 z) = tokenIdToCoordinate(tokenId);
        string memory id = tokenId.toString();
        string memory svg = string.concat('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#193b32"/><path d="M64 64H448V448H64Z M64 256H448 M256 64V448" fill="none" stroke="#94ad83"/><text x="90" y="220" fill="#eef3dc" font-size="30">WORLD PARCEL #', id, '</text><text x="90" y="300" fill="#eef3dc" font-size="20">', x.toString(), ' / ', z.toString(), '</text></svg>');
        return string.concat('data:application/json;base64,', Base64.encode(bytes(string.concat(
            '{"name":"World Parcel #', id, '","description":"A place in a shared deterministic procedural world.","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","animation_url":"', runtimeURL, '?tokenId=', id,
            '","attributes":[{"trait_type":"X","value":', x.toString(), '},{"trait_type":"Z","value":', z.toString(), '},{"trait_type":"Generator version","value":1}],"collection_seed":"', collectionSeed.toString(), '"}'
        ))));
    }
}
