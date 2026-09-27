// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ParcelState} from "../src/ParcelState.sol";
interface StateDeployVm { function envAddress(string calldata) external returns(address); function startBroadcast() external; function stopBroadcast() external; }
contract DeployParcelState {
    StateDeployVm constant vm = StateDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (ParcelState state) {
        address land = vm.envAddress("WORLD_PARCEL_NFT_ADDRESS");
        vm.startBroadcast(); state = new ParcelState(land); vm.stopBroadcast();
    }
}
