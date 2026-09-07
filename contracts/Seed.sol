// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Prototype reward token. Only its immutable farm can issue or spend rewards.
contract Seed is ERC20 {
    address public immutable farm;
    error OnlyFarm();
    constructor() ERC20("Cloudacre Test SEED", "SEED") { farm = msg.sender; }
    modifier onlyFarm() { if (msg.sender != farm) revert OnlyFarm(); _; }
    function mint(address to, uint256 amount) external onlyFarm { _mint(to, amount); }
    function spend(address from, uint256 amount) external onlyFarm { _burn(from, amount); }
}
