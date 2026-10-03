// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldEditionState} from "../src/WorldEditionState.sol";
interface EditionDeployVm {
    function envAddress(string calldata) external returns(address);
    function envUint(string calldata) external returns(uint256);
    function startBroadcast(address) external;
    function stopBroadcast() external;
}
/// @notice Add external editions to an existing parcel collection; does not mint or move assets.
contract DeployWorldEditions {
    EditionDeployVm constant vm=EditionDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    event WorldEditionsDeployed(address indexed land,address indexed escrow);
    function run() external {
        require(block.chainid==vm.envUint("EDITION_CHAIN_ID"),"Wrong chain");
        address land=vm.envAddress("EDITION_LAND_ADDRESS");address deployer=vm.envAddress("EDITION_DEPLOYER");
        vm.startBroadcast(deployer);WorldEditionState state=new WorldEditionState(land);vm.stopBroadcast();
        emit WorldEditionsDeployed(land,address(state));
    }
}
