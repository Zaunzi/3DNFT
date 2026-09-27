// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldParcelNFT} from "../src/WorldParcelNFT.sol";
interface Vm { function expectRevert() external; function prank(address) external; function parseJsonString(string calldata, string calldata) external pure returns(string memory); function parseJsonUint(string calldata, string calldata) external pure returns(uint256); }
contract WorldParcelNFTTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    WorldParcelNFT nft;
    function setUp() public { nft = new WorldParcelNFT(7422026, "https://world.example/nft/", address(this)); }
    function testMintAndTransfer() public {
        nft.mint(address(0xA11CE), 742);
        require(nft.ownerOf(742) == address(0xA11CE));
        vm.prank(address(0xA11CE)); nft.transferFrom(address(0xA11CE), address(0xB0B), 742);
        require(nft.ownerOf(742) == address(0xB0B));
        require(nft.collectionSeed() == 7422026 && nft.parcelState(742) == 0);
        require(bytes(nft.tokenURI(742)).length > 100);
    }
    function testBoundsAndDuplicate() public {
        nft.mint(address(1), 0); nft.mint(address(1), 4999);
        vm.expectRevert(); nft.mint(address(1), 5000);
        vm.expectRevert(); nft.mint(address(1), 0);
        vm.expectRevert(); nft.tokenURI(1);
        vm.expectRevert(); nft.ownerOf(1);
        vm.expectRevert(); nft.coordinateToTokenId(100, 0);
        vm.expectRevert(); nft.coordinateToTokenId(0, 50);
    }
    function testOnlyOwnerMints() public { vm.prank(address(0xB0B)); vm.expectRevert(); nft.mint(address(1), 4); }
    function testInvalidURL() public { vm.expectRevert(); new WorldParcelNFT(1, 'https://bad.example/"/', address(this)); }
    function testFuzzRoundTrip(uint16 raw) public view {
        uint256 id = uint256(raw) % 5000;
        (uint256 x, uint256 z) = nft.tokenIdToCoordinate(id);
        require(nft.coordinateToTokenId(x, z) == id);
    }
    function testInterfaces() public view { require(nft.supportsInterface(0x80ac58cd)); require(nft.supportsInterface(0x5b5e139f)); }
    function testMetadataJSON() public {
        nft.mint(address(1), 742);
        bytes memory uri = bytes(nft.tokenURI(742));
        bytes memory prefix = bytes("data:application/json;base64,");
        for (uint256 i; i < prefix.length; ++i) require(uri[i] == prefix[i]);
        string memory json = string(decode64(uri, prefix.length));
        require(keccak256(bytes(vm.parseJsonString(json, ".name"))) == keccak256("World Parcel #742"));
        require(keccak256(bytes(vm.parseJsonString(json, ".animation_url"))) == keccak256("https://world.example/nft/?tokenId=742"));
        require(keccak256(bytes(vm.parseJsonString(json, ".collection_seed"))) == keccak256("7422026"));
        require(vm.parseJsonUint(json, ".attributes[0].value") == 42);
        require(vm.parseJsonUint(json, ".attributes[1].value") == 7);
        require(bytes(vm.parseJsonString(json, ".image")).length > 100);
    }
    function decode64(bytes memory input, uint256 offset) private pure returns(bytes memory out) {
        bytes memory alphabet = bytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
        uint256 length = (input.length - offset) / 4 * 3;
        if (input[input.length-1] == '=') --length;
        if (input[input.length-2] == '=') --length;
        out = new bytes(length);
        uint256 buffer; uint256 bits; uint256 index;
        for (uint256 i = offset; i < input.length && input[i] != '='; ++i) {
            uint256 value;
            for (; value < 64; ++value) if (alphabet[value] == input[i]) break;
            require(value < 64);
            buffer = (buffer << 6) | value; bits += 6;
            if (bits >= 8) { bits -= 8; out[index++] = bytes1(uint8(buffer >> bits)); }
        }
    }
}
