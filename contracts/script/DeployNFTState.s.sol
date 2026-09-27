// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldNFTState} from "../src/WorldNFTState.sol";
import {ContainerItemState} from "../src/ContainerItemState.sol";
import {AtlasCharacters} from "../src/AtlasCharacters.sol";

interface NFTDeployVm {
    function envAddress(string calldata) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployNFTState {
    NFTDeployVm constant vm = NFTDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WorldNFTState world, ContainerItemState containers, AtlasCharacters characters) {
        address land = vm.envAddress("WORLD_PARCEL_NFT_ADDRESS");
        address items = vm.envAddress("ATLAS_ITEMS_ADDRESS");
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address authority = vm.envAddress("RECOVERY_AUTHORITY");
        vm.startBroadcast();
        world = new WorldNFTState(land, deployer);
        containers = new ContainerItemState(address(world), items);
        world.bindContainerItems(address(containers));
        world.transferOwnership(authority);
        characters = new AtlasCharacters(authority);
        vm.stopBroadcast();
    }
}
