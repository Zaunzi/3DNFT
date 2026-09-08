// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Game resource only: not a claim on physical oil or a price-pegged asset.
contract Oil is ERC20 {
    address public immutable field;
    error OnlyField();
    constructor() ERC20("Cloudacre Test Oil", "OIL") { field = msg.sender; }
    function mint(address to, uint256 amount) external {
        if (msg.sender != field) revert OnlyField();
        _mint(to, amount);
    }
    /// @notice Voluntary burn for future game integrations; never increases extraction rights.
    function spend(address owner, uint256 amount) external {
        if (msg.sender != field) revert OnlyField();
        _burn(owner, amount);
    }
    function burn(uint256 amount) external { _burn(msg.sender, amount); }
}
