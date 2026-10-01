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
    error InvalidTrinket();
    error InvalidQuantity();
    constructor(address authority) ERC1155("") Ownable(authority) {}
    function uri(uint256 id) public pure override returns (string memory) {
        if(id==0 || id>ITEM_COUNT) revert InvalidTrinket();
        return string.concat("https://3dnft.vercel.app/trinkets/metadata/",Strings.toString(id),".json");
    }
    function mint(address recipient,uint256 id,uint256 quantity) external onlyOwner {
        if(id==0 || id>ITEM_COUNT) revert InvalidTrinket();
        if(quantity==0 || quantity>1_000_000) revert InvalidQuantity();
        _mint(recipient,id,quantity,"");
    }
}
