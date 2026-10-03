// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {WorldEditionState} from "../src/WorldEditionState.sol";
import {DoodverseParcels} from "../src/DoodverseParcels.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
interface EditionVm {function prank(address) external;function expectRevert() external;}
contract EditionTokenFixture is ERC1155 {constructor() ERC1155("https://example.com/{id}.json"){} function mint(address to,uint256 id,uint256 q) external {_mint(to,id,q,"");}}
contract TransferLandOnDeposit is EditionTokenFixture {
    DoodverseParcels immutable parcel;
    constructor(DoodverseParcels p){parcel=p;}
    function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes memory data) public override {
        super.safeTransferFrom(from,to,id,amount,data);
        parcel.transferFrom(from,address(0xB0B),0);
    }
}
contract RejectEditionReceiver {}
contract ReenterEditionReceiver is ERC1155Holder {
    WorldEditionState state;uint256 attachment;bool public reentered;
    constructor(WorldEditionState s,uint256 id){state=s;attachment=id;}
    function collect() external {state.detach(attachment);}
    function onERC1155Received(address,address,uint256,uint256,bytes memory) public override returns(bytes4){(reentered,)=address(state).call(abi.encodeCall(state.detach,(attachment)));return this.onERC1155Received.selector;}
}
contract WorldEditionStateTest {
    EditionVm constant vm=EditionVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE);address constant BOB=address(0xB0B);
    DoodverseParcels land;EditionTokenFixture token;WorldEditionState state;
    function setUp() public {land=new DoodverseParcels(1,"https://example.com/",address(this));token=new EditionTokenFixture();state=new WorldEditionState(address(land));vm.prank(ALICE);land.mint(2);token.mint(ALICE,14,100);vm.prank(ALICE);token.setApprovalForAll(address(state),true);}
    function loc(uint16 parcel) private pure returns(WorldEditionState.Location memory){return WorldEditionState.Location(parcel,3200,3200,0);}
    function attach(uint256 q) private returns(uint256){vm.prank(ALICE);return state.attach(address(token),14,q,loc(0));}
    function testDepositCallbackCannotChangeParcelOwner() public {
        TransferLandOnDeposit malicious=new TransferLandOnDeposit(land);malicious.mint(ALICE,1,1);
        vm.prank(ALICE);malicious.setApprovalForAll(address(state),true);
        vm.prank(ALICE);land.setApprovalForAll(address(malicious),true);
        vm.prank(ALICE);vm.expectRevert();state.attach(address(malicious),1,1,loc(0));
        require(land.ownerOf(0)==ALICE&&malicious.balanceOf(ALICE,1)==1&&state.nextId()==0);
    }
    function testSaleTransfersClaimAndQuantityIsConserved() public {
        uint256 id=attach(3);require(token.balanceOf(ALICE,14)==97&&token.balanceOf(address(state),14)==3&&state.escrowed(address(token),14)==3);
        vm.prank(ALICE);land.transferFrom(ALICE,BOB,0);vm.prank(ALICE);vm.expectRevert();state.detach(id);
        vm.prank(BOB);state.detach(id);require(token.balanceOf(BOB,14)==3&&token.balanceOf(ALICE,14)==97&&state.getAttachments(0).length==0&&state.escrowed(address(token),14)==0);
        vm.prank(BOB);vm.expectRevert();state.detach(id);
    }
    function testMovesAndStableIdsKeepSingleLocation() public {
        uint256 a=attach(2);uint256 b=attach(1);vm.prank(ALICE);state.move(a,loc(1));
        require(state.getAttachments(0).length==1&&state.getAttachments(0)[0].id==b&&state.getAttachments(1)[0].id==a);
        vm.prank(ALICE);state.detach(b);vm.prank(ALICE);state.move(a,loc(0));require(state.getAttachments(1).length==0);
        vm.prank(ALICE);land.transferFrom(ALICE,BOB,1);vm.prank(ALICE);vm.expectRevert();state.move(a,loc(1));
    }
    function testAuthorizationApprovalZeroAndBalanceFailureAreAtomic() public {
        vm.prank(BOB);vm.expectRevert();state.attach(address(token),14,1,loc(0));
        vm.expectRevert();attach(0);vm.expectRevert();attach(101);
        vm.prank(ALICE);token.setApprovalForAll(address(state),false);vm.expectRevert();attach(1);
        require(state.nextId()==0&&state.getAttachments(0).length==0&&state.escrowed(address(token),14)==0);
    }
    function testDirectAndBatchTransfersRejected() public {
        vm.prank(ALICE);vm.expectRevert();token.safeTransferFrom(ALICE,address(state),14,1,"");
        uint256[] memory ids=new uint256[](1);ids[0]=14;uint256[] memory qs=new uint256[](1);qs[0]=1;
        vm.prank(ALICE);vm.expectRevert();token.safeBatchTransferFrom(ALICE,address(state),ids,qs,"");
        require(token.balanceOf(ALICE,14)==100);
    }
    function testReceiverRejectionAndReentrancy() public {
        uint256 id=attach(1);address rejecting=address(new RejectEditionReceiver());vm.prank(ALICE);land.transferFrom(ALICE,rejecting,0);
        vm.prank(rejecting);vm.expectRevert();state.detach(id);require(state.getAttachments(0).length==1&&token.balanceOf(address(state),14)==1);
        ReenterEditionReceiver receiver=new ReenterEditionReceiver(state,id);vm.prank(rejecting);land.transferFrom(rejecting,address(receiver),0);
        receiver.collect();require(!receiver.reentered()&&token.balanceOf(address(receiver),14)==1&&state.getAttachments(0).length==0);
    }
    function testCapacityAndSwapRemoval() public {for(uint256 i;i<64;i++)attach(1);vm.expectRevert();attach(1);vm.prank(ALICE);state.detach(20);uint256 id=attach(1);require(id==65&&state.getAttachments(0).length==64);}
    function testFuzzBounds(uint16 x,uint16 z,uint16 rotation,uint16 parcel) public {
        bool valid=x>=150&&x<=6250&&z>=150&&z<=6250&&rotation<36000&&parcel<2;
        vm.prank(ALICE);if(!valid)vm.expectRevert();state.attach(address(token),14,1,WorldEditionState.Location(parcel,x,z,rotation));
        require(state.getAttachments(parcel).length==(valid?1:0));
    }
    function testFuzzTokenQuantityAndMovement(uint256 tokenId,uint64 q,uint16 x) public {
        uint256 amount=uint256(q)+1;token.mint(ALICE,tokenId,amount);vm.prank(ALICE);uint256 id=state.attach(address(token),tokenId,amount,loc(0));
        vm.prank(ALICE);state.move(id,WorldEditionState.Location(1,uint16(150+x%6101),3200,0));
        vm.prank(ALICE);land.transferFrom(ALICE,BOB,1);vm.prank(BOB);state.detach(id);
        require(token.balanceOf(BOB,tokenId)==amount&&state.escrowed(address(token),tokenId)==0);
    }
}

