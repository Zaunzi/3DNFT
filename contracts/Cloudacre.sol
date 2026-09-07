// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Seed} from "./Seed.sol";

/// @notice Testnet prototype: a free land faucet and a capped, time-based farming economy.
/// @dev Upgrades and unharvested resources travel with the NFT; harvested SEED stays in the wallet.
contract Cloudacre is ERC721, ReentrancyGuard {
    using Strings for uint256;
    struct Plot { uint256 stored; uint64 updated; uint8 level; }
    Seed public immutable seed;
    string public publicOrigin;
    uint256 public nextTokenId = 1;
    uint256 public constant MAX_SUPPLY = 1000;
    mapping(uint256 => Plot) public plots;
    mapping(address => bool) public hasMinted;
    event Harvested(uint256 indexed tokenId, address indexed owner, uint256 amount);
    event Upgraded(uint256 indexed tokenId, uint8 level, uint256 cost);
    event MetadataUpdate(uint256 _tokenId);
    error NotLandOwner(); error NothingToHarvest(); error FullyUpgraded(); error FaucetLimit();
    constructor(string memory origin) ERC721("Cloudacre Test Land", "ACRE") {
        publicOrigin = origin;
        seed = new Seed();
    }
    function mint() external nonReentrant returns (uint256 id) {
        if (hasMinted[msg.sender] || nextTokenId > MAX_SUPPLY) revert FaucetLimit();
        hasMinted[msg.sender] = true;
        id = nextTokenId++;
        plots[id] = Plot(20 ether, uint64(block.timestamp), 0);
        _safeMint(msg.sender, id);
    }
    function rate(uint8 level) public pure returns (uint256) { return (6 ether) << level; }
    function capacity(uint8 level) public pure returns (uint256) { return (20 ether) << level; }
    function upgradeCost(uint8 level) public pure returns (uint256) {
        if(level == 0) return 20 ether;
        if(level == 1) return 45 ether;
        if(level == 2) return 90 ether;
        revert FullyUpgraded();
    }
    function pending(uint256 id) public view returns (uint256) {
        _requireOwned(id);
        Plot memory p = plots[id];
        uint256 total = p.stored + (block.timestamp - p.updated) * rate(p.level) / 60;
        uint256 cap = capacity(p.level);
        return total > cap ? cap : total;
    }
    function _checkpoint(uint256 id) private {
        plots[id].stored = pending(id);
        plots[id].updated = uint64(block.timestamp);
    }
    function harvest(uint256 id) external nonReentrant {
        if(ownerOf(id) != msg.sender) revert NotLandOwner();
        _checkpoint(id);
        uint256 amount = plots[id].stored;
        if(amount == 0) revert NothingToHarvest();
        plots[id].stored = 0;
        seed.mint(msg.sender, amount);
        emit Harvested(id, msg.sender, amount);
    }
    function upgrade(uint256 id) external nonReentrant {
        if(ownerOf(id) != msg.sender) revert NotLandOwner();
        uint8 level = plots[id].level;
        uint256 cost = upgradeCost(level);
        _checkpoint(id); // Settle old production before changing the rate.
        plots[id].level = level + 1;
        seed.spend(msg.sender, cost); // Reverts the whole upgrade if the balance is insufficient.
        emit Upgraded(id, level + 1, cost);
        emit MetadataUpdate(id);
    }
    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0x49064906 || super.supportsInterface(id);
    }
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        string memory number = id.toString();
        string memory level = uint256(plots[id].level + 1).toString();
        string memory svg = string.concat('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#d2e6df"/><text x="70" y="300" font-size="64" fill="#365b42">Cloudacre #', number, '</text><text x="70" y="410" font-size="38" fill="#365b42">Land level ', level, '</text><text x="70" y="490" font-size="26" fill="#365b42">Open to explore your 3D island</text></svg>');
        string memory json = string.concat('{"name":"Cloudacre #',number,'","description":"Evolving testnet farm. Test SEED has no promised value.","image":"data:image/svg+xml;base64,',Base64.encode(bytes(svg)),'","animation_url":"',publicOrigin,'/embed/?token=',number,'","external_url":"',publicOrigin,'/nft/?token=',number,'","attributes":[{"trait_type":"Level","value":',level,'},{"trait_type":"SEED per minute","value":',(rate(plots[id].level)/1 ether).toString(),'}]}');
        return string.concat('data:application/json;base64,',Base64.encode(bytes(json)));
    }
}
