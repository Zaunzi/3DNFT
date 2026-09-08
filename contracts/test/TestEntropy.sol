// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
/// @dev Local test double only. Never deploy as a production randomness source.
contract TestEntropy {
    address public defaultProvider = address(0xBEEF);
    uint128 public fee = 100;
    uint64 public sequence = 1;
    mapping(uint64 => address) public consumers;
    function getDefaultProvider() external view returns(address) { return defaultProvider; }
    function getFeeV2(address, uint32) external view returns(uint128) { return fee; }
    function setFee(uint128 amount) external { fee = amount; }
    function requestV2(address, bytes32, uint32) external payable returns(uint64 seq) {
        require(msg.value == fee, "fee"); seq = sequence++; consumers[seq] = msg.sender;
    }
    function fulfill(uint64 seq, bytes32 value) external { IEntropyConsumer(consumers[seq])._entropyCallback(seq, defaultProvider, value); }
    function deliver(address consumer, uint64 seq, address provider, bytes32 value) external {
        IEntropyConsumer(consumer)._entropyCallback(seq,provider,value);
    }
}
