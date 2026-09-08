// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {Oil} from "./Oil.sol";

/// @notice New testnet collection. Does not modify the original Cloudacre/SEED contracts.
/// @dev A parcel gets at most one request per season. Requests cannot be cancelled or rerolled.
contract OilField is ERC721, ReentrancyGuard, IEntropyConsumer {
    using Strings for uint256;
    uint256 public constant SEASON_DURATION = 7 days;
    uint32 public constant CALLBACK_GAS_LIMIT = 200000;
    uint256 public immutable genesis;
    IEntropyV2 public immutable entropy;
    address public immutable entropyProvider;
    Oil public immutable oil;
    string public publicOrigin;
    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public totalMinted;
    uint256[3] public mintedBySize;
    mapping(address => bool) public hasMinted;
    mapping(uint256 => uint8) public parcelSize;
    mapping(uint256 => uint8) public equipmentLevel;
    mapping(uint256 => uint256) public mintedSeason;
    struct Reserve {
        uint128 allocation;
        uint128 harvested;
        uint64 sequence;
        bool requested;
        bool fulfilled;
        uint64 checkpoint;
        uint64 work;
        uint8 level;
    }
    struct Request { uint256 tokenId; uint256 season; }
    mapping(uint256 => mapping(uint256 => Reserve)) public reserves;
    mapping(uint64 => Request) public requests;
    event SurveyRequested(uint256 indexed tokenId, uint256 indexed season, uint64 sequence, address provider);
    event ReserveDiscovered(uint256 indexed tokenId, uint256 indexed season, uint256 allocation);
    event OilHarvested(uint256 indexed tokenId, uint256 indexed season, address indexed owner, uint256 amount);
    event EquipmentUpgraded(uint256 indexed tokenId, uint8 level, uint256 cost);
    event MetadataUpdate(uint256 _tokenId);
    error NotOwner(); error InvalidSize(); error FaucetLimit(); error AlreadyRequested();
    error WrongSeason(); error IncorrectFee(uint256 expected); error NothingToHarvest(); error InvalidEntropy();

    constructor(string memory origin, address entropyAddress) ERC721("Cloudacre Oil Parcels", "PLOT") {
        if (entropyAddress.code.length == 0) revert InvalidEntropy();
        entropy = IEntropyV2(entropyAddress);
        address provider = IEntropyV2(entropyAddress).getDefaultProvider();
        if (provider == address(0)) revert InvalidEntropy();
        entropyProvider = provider;
        oil = new Oil();
        genesis = block.timestamp;
        publicOrigin = origin;
    }
    function currentSeason() public view returns (uint256) { return (block.timestamp - genesis) / SEASON_DURATION + 1; }
    function seasonStart(uint256 season) public view returns (uint256) {
        if (season == 0 || season > currentSeason()) revert WrongSeason();
        return genesis + (season - 1) * SEASON_DURATION;
    }
    function sizeSupply(uint8 size) public pure returns (uint256) {
        if(size > 2) revert InvalidSize();
        return size == 2 ? 200 : 400;
    }
    function plannedSize(uint256 id) public pure returns (uint8) {
        require(id > 0 && id <= MAX_SUPPLY, "Invalid parcel ID");
        return id <= 400 ? 0 : id <= 800 ? 1 : 2;
    }
    function districtParcel(uint256 id) external view returns (uint8 size, address owner, uint8 level) {
        return (plannedSize(id), _ownerOf(id), equipmentLevel[id]);
    }
    function allocationBounds(uint8 size) public pure returns (uint256 minimum, uint256 maximum) {
        if(size > 2) revert InvalidSize();
        if(size == 0) return (1000, 2000);
        if(size == 1) return (2500, 5000);
        return (6000, 10000);
    }
    function sizeName(uint8 size) public pure returns (string memory) { return size == 0 ? "Small" : size == 1 ? "Medium" : "Large"; }
    function mint(uint8 size) external nonReentrant returns (uint256 id) {
        uint256 limit = sizeSupply(size);
        if(hasMinted[msg.sender] || mintedBySize[size] >= limit) revert FaucetLimit();
        hasMinted[msg.sender] = true;
        id = (size == 0 ? 0 : size == 1 ? 400 : 800) + ++mintedBySize[size];
        totalMinted++;
        parcelSize[id] = size;
        mintedSeason[id] = currentSeason();
        _safeMint(msg.sender, id);
    }
    function surveyFee() public view returns (uint256) { return entropy.getFeeV2(entropyProvider, CALLBACK_GAS_LIMIT); }
    /// @param season Explicit expected season prevents a delayed wallet transaction surveying the next season.
    /// @param userRandomNumber Browser-generated entropy, combined by Pyth with the provider contribution.
    function survey(uint256 id, uint256 season, bytes32 userRandomNumber) external payable nonReentrant {
        if(ownerOf(id) != msg.sender) revert NotOwner();
        if(season != currentSeason()) revert WrongSeason();
        Reserve storage r = reserves[id][season];
        if(r.requested) revert AlreadyRequested();
        uint256 fee = surveyFee();
        if(msg.value != fee) revert IncorrectFee(fee);
        r.requested = true;
        r.checkpoint = uint64(seasonStart(season));
        r.level = equipmentLevel[id];
        uint64 seq = entropy.requestV2{value:fee}(entropyProvider, userRandomNumber, CALLBACK_GAS_LIMIT);
        r.sequence = seq;
        requests[seq] = Request(id, season);
        emit SurveyRequested(id, season, seq, entropyProvider);
    }
    function getEntropy() internal view override returns (address) { return address(entropy); }
    /// @dev Authenticate via the SDK wrapper; ignore unknown/duplicate/provider-mismatched callbacks.
    /// No external calls or unbounded loops. A delayed callback still resolves its original season.
    function entropyCallback(uint64 sequence, address provider, bytes32 randomNumber) internal override {
        if(provider != entropyProvider) return;
        Request memory request = requests[sequence];
        if(request.tokenId == 0) return;
        Reserve storage r = reserves[request.tokenId][request.season];
        if(!r.requested || r.fulfilled || r.sequence != sequence) return;
        (uint256 minimum, uint256 maximum) = allocationBounds(parcelSize[request.tokenId]);
        // Modulo bias over a 256-bit input is negligible for these small ranges.
        r.allocation = uint128((minimum + uint256(randomNumber) % (maximum - minimum + 1)) * 1 ether);
        r.fulfilled = true;
        delete requests[sequence];
        emit ReserveDiscovered(request.tokenId, request.season, r.allocation);
        emit MetadataUpdate(request.tokenId);
    }
    function claimable(uint256 id, uint256 season) public view returns (uint256) {
        _requireOwned(id);
        seasonStart(season);
        Reserve memory r = reserves[id][season];
        if(!r.fulfilled) return 0;
        uint256 work = uint256(r.work) + (block.timestamp - r.checkpoint) * (4 + r.level);
        if(work > SEASON_DURATION * 4) work = SEASON_DURATION * 4;
        uint256 unlocked = uint256(r.allocation) * work / (SEASON_DURATION * 4);
        return unlocked - r.harvested;
    }
    function harvest(uint256 id, uint256 season) external nonReentrant {
        if(ownerOf(id) != msg.sender) revert NotOwner();
        uint256 amount = claimable(id, season);
        if(amount == 0) revert NothingToHarvest();
        reserves[id][season].harvested += uint128(amount);
        oil.mint(msg.sender, amount);
        emit OilHarvested(id, season, msg.sender, amount);
    }
    function upgradeCost(uint256 id) public view returns (uint256) {
        _requireOwned(id);
        uint8 level = equipmentLevel[id];
        if(level >= 3) return 0;
        return (uint256(250) * (level + 1) * (level + 1) * (parcelSize[id] + 1)) * 1 ether;
    }
    function upgrade(uint256 id) external nonReentrant {
        if(ownerOf(id) != msg.sender) revert NotOwner();
        uint256 cost = upgradeCost(id);
        require(cost > 0, "Maximum equipment level");
        Reserve storage r = reserves[id][currentSeason()];
        if(r.requested) {
            uint256 work = uint256(r.work) + (block.timestamp - r.checkpoint) * (4 + r.level);
            r.work = uint64(work > SEASON_DURATION * 4 ? SEASON_DURATION * 4 : work);
            r.checkpoint = uint64(block.timestamp);
            r.level = equipmentLevel[id] + 1;
        }
        equipmentLevel[id]++;
        oil.spend(msg.sender, cost);
        emit EquipmentUpgraded(id, equipmentLevel[id], cost);
        emit MetadataUpdate(id);
    }
    function supportsInterface(bytes4 id) public view override returns (bool) { return id == 0x49064906 || super.supportsInterface(id); }
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        string memory number = id.toString();
        string memory size = sizeName(parcelSize[id]);
        string memory svg = string.concat('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#172126"/><text x="65" y="310" font-size="58" fill="#f0ba64">OIL PARCEL #', number, '</text><text x="65" y="410" font-size="40" fill="#ffffff">',size,' land</text><text x="65" y="480" font-size="25" fill="#a4b2b7">Seasonal reserves / Pyth Entropy</text></svg>');
        string memory json = string.concat('{"name":"Oil Parcel #',number,'","description":"Seasonal game OIL. No physical oil backing or price peg.","image":"data:image/svg+xml;base64,',Base64.encode(bytes(svg)),'","animation_url":"',publicOrigin,'/oil/embed/?token=',number,'","external_url":"',publicOrigin,'/oil/nft/?token=',number,'","attributes":[{"trait_type":"Parcel size","value":"',size,'"},{"trait_type":"Season duration (days)","value":7},{"trait_type":"Equipment level","value":',uint256(equipmentLevel[id]).toString(),'}]}');
        return string.concat('data:application/json;base64,',Base64.encode(bytes(json)));
    }
}
