// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {CollectionControls} from "./CollectionControls.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface KeyLand {function ownerOf(uint256) external view returns(address);function ownershipEpoch(uint256) external view returns(uint256);}
interface KeyWorld {function land() external view returns(address);}
/// @notice Distinct lock keys. Expired tokens remain transferable collectibles, not access rights.
contract DoodverseKeys is ERC1155, CollectionControls, ReentrancyGuard {
    string public constant name="Doodverse Keys";
    string public constant symbol="DOODKEY";
    KeyLand public immutable land;
    address public world;
    uint256 public nextKey;
    struct KeyRecord {uint16 parcel;uint256 epoch;bool revoked;}
    mapping(uint256=>KeyRecord) public records;
    event KeyCreated(uint256 indexed id,uint16 indexed parcel,uint256 epoch);
    event KeyRevoked(uint256 indexed id);
    event WorldBound(address world);
    /// @notice One URI/template for all keys. Updating it never changes access rights.
    function setURI(string calldata value) external onlyOwner {
        if (bytes(value).length == 0) revert InvalidMetadataURI();
        _setURI(value);
        emit MetadataURIUpdated(value);
    }
    error Unauthorized();error InvalidKey();error InvalidQuantity();
    constructor(address landAddress,address authority) ERC1155('data:application/json;utf8,{"name":"Key","description":"A Doodverse lock key. Access may expire on rekey or parcel transfer."}') CollectionControls(authority){require(landAddress.code.length>0);land=KeyLand(landAddress);}
    function bindWorld(address target) external onlyOwner {require(world==address(0)&&target.code.length>0&&KeyWorld(target).land()==address(land));world=target;emit WorldBound(target);}
    function create(uint16 parcel,address controller) external whenMintingOpen nonReentrant returns(uint256 id){
        if(msg.sender!=world||land.ownerOf(parcel)!=controller)revert Unauthorized();
        id=++nextKey;records[id]=KeyRecord(parcel,land.ownershipEpoch(parcel),false);
        emit KeyCreated(id,parcel,records[id].epoch);_mint(controller,id,1,"");
        if(land.ownerOf(parcel)!=controller||land.ownershipEpoch(parcel)!=records[id].epoch)revert Unauthorized();
    }
    function revoke(uint256 id) external {if(msg.sender!=world)revert Unauthorized();if(id==0||id>nextKey)revert InvalidKey();records[id].revoked=true;emit KeyRevoked(id);}
    function active(uint256 id) public view returns(bool){if(id==0||id>nextKey)return false;KeyRecord memory r=records[id];return !r.revoked&&land.ownershipEpoch(r.parcel)==r.epoch;}
    function canUse(uint256 id,address account) external view returns(bool){return account!=address(0)&&active(id)&&balanceOf(account,id)>0;}
    function issueCopies(uint256 id,address recipient,uint256 quantity) external whenMintingOpen nonReentrant {
        if(!active(id))revert InvalidKey();KeyRecord memory r=records[id];if(land.ownerOf(r.parcel)!=msg.sender)revert Unauthorized();
        if(quantity==0||quantity>100)revert InvalidQuantity();_mint(recipient,id,quantity,"");
        if(land.ownerOf(r.parcel)!=msg.sender||land.ownershipEpoch(r.parcel)!=r.epoch)revert Unauthorized();
    }
}
