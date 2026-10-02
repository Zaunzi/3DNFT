// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
/// @notice Instrument editions are separate from parcel utilities and their escrow.
contract DoodverseTrinkets is ERC1155, Ownable {
    string public constant name = "Doodverse Trinkets";
    string public constant symbol = "DOODTRINKET";
    uint256 public constant ITEM_COUNT = 5;
    bool public constant PUBLIC_MINT = true;
    mapping(address => mapping(uint256 => bool)) public minted;
    error AlreadyMinted();
    error InvalidRecipient();
    error InvalidTrinket();
    error InvalidQuantity();
    constructor(address authority) ERC1155("") Ownable(authority) {}
    function uri(uint256 id) public pure override returns (string memory) {
        if(id==0 || id>ITEM_COUNT) revert InvalidTrinket();
        return string.concat("https://atlas-mu-lime.vercel.app/trinkets/metadata/",Strings.toString(id),".json");
    }
    /// @notice A lifetime mint allowance, independent of balances, transfers or escrow.
    function mint(uint256 id) external { _claim(msg.sender,id); }
    /// @notice Compatibility selector cannot bypass the self-mint or lifetime limit.
    function mint(address recipient,uint256 id,uint256 quantity) external {
        if(recipient!=msg.sender) revert InvalidRecipient();
        if(quantity!=1) revert InvalidQuantity();
        _claim(recipient,id);
    }
    function _claim(address recipient,uint256 id) private {
        if(id==0 || id>ITEM_COUNT) revert InvalidTrinket();
        if(minted[recipient][id]) revert AlreadyMinted();
        // Commit before ERC-1155 receiver callbacks, preventing same-ID reentrant claims.
        minted[recipient][id]=true;
        _mint(recipient,id,1,"");
    }
}
