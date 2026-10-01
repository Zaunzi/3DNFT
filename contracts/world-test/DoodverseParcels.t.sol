// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
interface Vm { function expectRevert() external; function prank(address) external; function parseJsonString(string calldata, string calldata) external pure returns(string memory); function parseJsonUint(string calldata, string calldata) external pure returns(uint256); }
contract DoodverseParcelsTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    DoodverseParcels nft;
    function setUp() public { nft = new DoodverseParcels(7422026, "https://world.example/nft/", address(this)); }
    function testPublicMintAndTransferDoesNotResetLimit() public {
        address alice=address(0xA11CE);address bob=address(0xB0B);
        vm.prank(alice);nft.mint(5);
        require(nft.totalSupply()==5&&nft.mintedBy(alice)==5&&nft.ownerOf(4)==alice);
        vm.prank(alice);nft.transferFrom(alice,bob,0);
        vm.prank(alice);vm.expectRevert();nft.mint(1);
        vm.prank(bob);nft.mint(2);
        require(nft.ownerOf(5)==bob&&nft.ownerOf(6)==bob&&nft.mintedBy(bob)==2);
    }
    function testInvalidQuantityAndUnminted() public {
        vm.expectRevert();nft.mint(0);
        vm.expectRevert();nft.mint(6);
        vm.expectRevert();nft.tokenURI(0);
        vm.expectRevert();nft.coordinateToTokenId(100,0);
        require(nft.totalSupply()==0&&nft.mintedBy(address(this))==0);
    }
    function testFuzzMintAllowance(uint8 raw) public {
        uint256 quantity=1+uint256(raw)%5;
        vm.prank(address(1));nft.mint(quantity);
        require(nft.totalSupply()==quantity&&nft.mintedBy(address(1))==quantity);
        for(uint256 i;i<quantity;i++)require(nft.ownerOf(i)==address(1));
    }
    function testSupplyExhaustion() public {
        for(uint256 i;i<1000;i++){vm.prank(address(uint160(i+100)));nft.mint(5);}
        require(nft.totalSupply()==5000);
        vm.prank(address(9000));vm.expectRevert();nft.mint(1);
    }
    function testReceiverReentrancyAndRejection() public {
        MintReceiver receiver=new MintReceiver(nft);
        receiver.claim(false);
        require(nft.totalSupply()==1&&nft.mintedBy(address(receiver))==1);
        vm.expectRevert();receiver.claim(true);
        require(nft.totalSupply()==1&&nft.mintedBy(address(receiver))==1);
    }
    function testInvalidURL() public { vm.expectRevert(); new DoodverseParcels(1, 'https://bad.example/"/', address(this)); }
    function testFuzzRoundTrip(uint16 raw) public view {
        uint256 id = uint256(raw) % 5000;
        (uint256 x, uint256 z) = nft.tokenIdToCoordinate(id);
        require(nft.coordinateToTokenId(x, z) == id);
    }
    function testInterfaces() public view { require(nft.supportsInterface(0x80ac58cd)); require(nft.supportsInterface(0x5b5e139f)); }
    function testMetadataJSON() public {
        vm.prank(address(1)); nft.mint(1);
        bytes memory uri = bytes(nft.tokenURI(0));
        bytes memory prefix = bytes("data:application/json;base64,");
        for (uint256 i; i < prefix.length; ++i) require(uri[i] == prefix[i]);
        string memory json = string(decode64(uri, prefix.length));
        require(keccak256(bytes(vm.parseJsonString(json, ".name"))) == keccak256("Doodverse Parcel #0"));
        require(keccak256(bytes(vm.parseJsonString(json, ".animation_url"))) == keccak256("https://world.example/nft/?tokenId=0"));
        require(keccak256(bytes(vm.parseJsonString(json, ".collection_seed"))) == keccak256("7422026"));
        require(vm.parseJsonUint(json, ".attributes[0].value") == 0);
        require(vm.parseJsonUint(json, ".attributes[1].value") == 0);
        require(vm.parseJsonUint(json, ".attributes[2].value") == 2);
        require(nft.GENERATOR_VERSION() == 2);
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

contract MintReceiver is IERC721Receiver {
    DoodverseParcels immutable parcel; bool reject;
    constructor(DoodverseParcels p){parcel=p;}
    function claim(bool shouldReject) external {reject=shouldReject;parcel.mint(1);}
    function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4) {
        require(!reject,"Receiver rejected");
        (bool ok,)=address(parcel).call(abi.encodeCall(parcel.mint,(1)));
        require(!ok,"Reentry unexpectedly succeeded");
        return this.onERC721Received.selector;
    }
}
