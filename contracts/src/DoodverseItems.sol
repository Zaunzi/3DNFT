// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {AtlasItems} from "./AtlasItems.sol";
/// @notice Doodverse collection; retains the established item IDs and custody ABI.
contract DoodverseItems is AtlasItems {
    string public constant name = "Doodverse Parcel Items";
    string public constant symbol = "DOODPARCELITEM";
    constructor(address authority, string memory metadataURI) AtlasItems(authority, metadataURI) {}
}
