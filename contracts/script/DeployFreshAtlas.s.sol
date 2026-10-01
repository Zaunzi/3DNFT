// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
import {DoodverseParcelState} from "../src/DoodverseParcelState.sol";
import {DoodverseItems} from "../src/DoodverseItems.sol";
import {WorldItemState} from "../src/WorldItemState.sol";
import {PortalState} from "../src/PortalState.sol";
import {DoodverseNFTState} from "../src/DoodverseNFTState.sol";
import {ContainerItemState} from "../src/ContainerItemState.sol";
import {DoodverseCharacters} from "../src/DoodverseCharacters.sol";
import {DoodverseTrinkets} from "../src/DoodverseTrinkets.sol";
import {DoodverseKeys} from "../src/DoodverseKeys.sol";
interface FreshVm {
    function envAddress(string calldata) external returns(address);
    function envUint(string calldata) external returns(uint256);
    function envString(string calldata) external returns(string memory);
    function startBroadcast(address) external;
    function stopBroadcast() external;
}
/// @notice Fresh collection and full suite. Does not mint or modify any previous deployment.
contract DeployFreshAtlas {
    FreshVm constant vm=FreshVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    event FreshSuite(address land,address state,address items,address worldItems,address portals,address nfts,address containerItems,address characters);
    event KeysDeployed(address keys);
    event TrinketsDeployed(address trinkets);
    function run() external {
        require(block.chainid==vm.envUint("FRESH_CHAIN_ID"),"Wrong chain");
        address deployer=vm.envAddress("FRESH_DEPLOYER");
        address authority=vm.envAddress("FRESH_OWNER");
        require(deployer!=address(0)&&authority!=address(0),"Zero authority");
        uint256 seed=vm.envUint("FRESH_SEED");
        string memory runtime=vm.envString("FRESH_RUNTIME_URL");
        string memory itemURI=vm.envString("FRESH_ITEM_URI");
        vm.startBroadcast(deployer);
        DoodverseParcels land=new DoodverseParcels(seed,runtime,authority);
        DoodverseParcelState state=new DoodverseParcelState(address(land));
        DoodverseItems items=new DoodverseItems(authority,itemURI);
        WorldItemState worldItems=new WorldItemState(address(land),address(items));
        PortalState portals=new PortalState(address(land));
        DoodverseNFTState nfts=new DoodverseNFTState(address(land),deployer);
        ContainerItemState containers=new ContainerItemState(address(nfts),address(items));
        nfts.bindContainerItems(address(containers));
        DoodverseKeys keys=new DoodverseKeys(address(land),deployer);
        keys.bindWorld(address(nfts));nfts.bindLockKeys(address(keys));
        if(authority!=deployer) keys.transferOwnership(authority);
        emit KeysDeployed(address(keys));
        if(authority!=deployer) nfts.transferOwnership(authority);
        DoodverseCharacters characters=new DoodverseCharacters(authority);
        DoodverseTrinkets trinkets=new DoodverseTrinkets(authority);
        vm.stopBroadcast();
        emit TrinketsDeployed(address(trinkets));
        require(address(state.land())==address(land)&&address(nfts.land())==address(land),"Binding mismatch");
        emit FreshSuite(address(land),address(state),address(items),address(worldItems),address(portals),address(nfts),address(containers),address(characters));
    }
}
