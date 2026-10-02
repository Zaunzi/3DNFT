// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Collection administration pauses issuance, never transfers or escrow withdrawals.
abstract contract CollectionControls is Ownable {
    bool public mintPaused;
    error MintingPaused();
    error InvalidMetadataURI();
    event MintPausedChanged(bool paused);
    event MetadataURIUpdated(string metadataURI);

    constructor(address authority) Ownable(authority) {}

    modifier whenMintingOpen() {
        if (mintPaused) revert MintingPaused();
        _;
    }

    function setMintPaused(bool paused) external onlyOwner {
        mintPaused = paused;
        emit MintPausedChanged(paused);
    }

    function _validateMetadataBaseURI(string memory value) internal pure {
        bytes memory b = bytes(value);
        if (b.length == 0 || b[b.length - 1] != '/') revert InvalidMetadataURI();
    }
}
