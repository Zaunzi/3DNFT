import {nftTransferErrors,explainNFTTransferError} from '../nfts/transferErrors.ts';
import {parseAbi,getAddress,type Address,type Abi} from 'viem';
import type {OnchainParcelStateProvider} from '../blockchain/client.ts';
import type {InjectedWallet} from '../blockchain/wallet.ts';
import {assetKey,validateLocation,type NFTAsset} from '../nfts/model.ts';
import {editionURI,validateEdition,type EditionProvider,type EditionLocation} from './model.ts';
const tokenAbi=parseAbi(['function balanceOf(address,uint256) view returns(uint256)','function uri(uint256) view returns(string)','function isApprovedForAll(address,address) view returns(bool)','function setApprovalForAll(address,bool)','function supportsInterface(bytes4) view returns(bool)']);
export const editionAbi=parseAbi([
 'function land() view returns(address)','function SCHEMA_VERSION() view returns(uint8)',
 'function getAttachments(uint256) view returns((uint256 id,address collection,uint256 tokenId,uint256 quantity,address depositor,(uint16 parcelId,uint16 x,uint16 z,uint16 rotation) location)[])',
 'function attach(address,uint256,uint256,(uint16 parcelId,uint16 x,uint16 z,uint16 rotation)) returns(uint256)',
 'function move(uint256,(uint16 parcelId,uint16 x,uint16 z,uint16 rotation))','function detach(uint256)',
 'error Unauthorized()','error InvalidPlacement()','error InvalidAsset()','error ParcelFull()','error UnknownAttachment()','error UnexpectedTransfer()','error CustodyMismatch()',
]);
export class OnchainEditionProvider implements EditionProvider {
    readonly enabled:boolean;
    private client:OnchainParcelStateProvider['client'];private wallet:InjectedWallet;private land:Address;readonly address?:Address;
    constructor(client:OnchainParcelStateProvider['client'],wallet:InjectedWallet,land:Address,address?:Address){this.client=client;this.wallet=wallet;this.land=land;this.address=address;this.enabled=!!address;}
    async validateDeployment(){if(!this.address)return;const [land,version]=await Promise.all([this.client.readContract({address:this.address,abi:editionAbi,functionName:'land'}),this.client.readContract({address:this.address,abi:editionAbi,functionName:'SCHEMA_VERSION'})]);if(land.toLowerCase()!==this.land.toLowerCase()||version!==1)throw new Error('External ERC-1155 deployment mismatch');}
    private asset(a:NFTAsset){assetKey(a);if(a.chainId!==this.client.chain.id)throw new Error('Wrong asset chain');}
    async balance(a:NFTAsset,owner:string){this.asset(a);return this.client.readContract({address:a.contractAddress,abi:tokenAbi,functionName:'balanceOf',args:[getAddress(owner),a.tokenId]});}
    async uri(a:NFTAsset){this.asset(a);const supported=await this.client.readContract({address:a.contractAddress,abi:tokenAbi,functionName:'supportsInterface',args:['0xd9b67a26']});if(!supported)throw new Error('Collection is not ERC-1155');return editionURI(await this.client.readContract({address:a.contractAddress,abi:tokenAbi,functionName:'uri',args:[a.tokenId]}),a.tokenId);}
    async snapshot(parcel:number){if(!this.address)return [];const rows=await this.client.readContract({address:this.address,abi:editionAbi,functionName:'getAttachments',args:[BigInt(parcel)]});return rows.map(a=>({id:a.id,asset:{chainId:this.client.chain.id,contractAddress:a.collection,tokenId:a.tokenId},quantity:a.quantity,depositor:a.depositor,location:a.location}));}
    async approved(a:NFTAsset,owner:string){this.asset(a);return !!this.address&&await this.client.readContract({address:a.contractAddress,abi:tokenAbi,functionName:'isApprovedForAll',args:[getAddress(owner),this.address]});}
    private async write(address:Address,abi:Abi,functionName:string,args:readonly unknown[]){if(!this.address)throw new Error('Deploy and configure WorldEditionState to enable ERC-1155 placement');const wallet=await this.wallet.forChain(this.client.chain.id);const {request}=await this.client.simulateContract({address,abi:[...abi,...nftTransferErrors],functionName,args,account:wallet.account}).catch(error=>{throw explainNFTTransferError(error);});const fresh=await this.wallet.forChain(this.client.chain.id);if(fresh.account.address!==wallet.account.address)throw new Error('Wallet changed');const hash=await fresh.writeContract({...request,chain:this.client.chain});if((await this.client.waitForTransactionReceipt({hash})).status!=='success')throw new Error('Transaction reverted');}
    async approve(a:NFTAsset){this.asset(a);await this.write(a.contractAddress,tokenAbi,'setApprovalForAll',[this.address,true]);}
    async attach(a:NFTAsset,q:bigint,l:EditionLocation){this.asset(a);validateEdition(a,q,l);await this.write(this.address!,editionAbi,'attach',[a.contractAddress,a.tokenId,q,l]);}
    async move(id:bigint,l:EditionLocation){validateLocation({kind:'parcel',...l});await this.write(this.address!,editionAbi,'move',[id,l]);}
    async detach(id:bigint){await this.write(this.address!,editionAbi,'detach',[id]);}
}
