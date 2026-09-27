// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
interface DeployVm { function envUint(string calldata) external returns(uint256); function envString(string calldata) external returns(string memory); function envAddress(string calldata) external returns(address); function startBroadcast() external; function stopBroadcast() external; }
contract DeployWorld {
    DeployVm constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (WorldParcelNFT nft) {
        uint256 seed = vm.envUint("WORLD_SEED");
        string memory runtime = vm.envString("WORLD_RUNTIME_URL");
        address owner = vm.envAddress("WORLD_OWNER");
        vm.startBroadcast(); nft = new WorldParcelNFT(seed, runtime, owner); vm.stopBroadcast();
    }
}
