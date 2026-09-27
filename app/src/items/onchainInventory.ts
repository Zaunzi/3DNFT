import { parseAbi, type Abi, type Address } from 'viem';
import type { OnchainParcelStateProvider } from '../blockchain/client.ts';
import type { InjectedWallet } from '../blockchain/wallet.ts';
import { ITEM_DEFINITIONS, itemDefinition } from './definitions.ts';
import { validateItemPlacement, validatePortal, type ItemPlacement, type LocalTransform, type Portal, type AttachedWorldItem } from './model.ts';
import type { ExperienceStore } from './providers.ts';
export const itemsAbi = parseAbi([
  'function REGISTRY_VERSION() view returns(uint8)',
  'function balanceOf(address,uint256) view returns(uint256)',
  'function balanceOfBatch(address[],uint256[]) view returns(uint256[])',
  'function isApprovedForAll(address,address) view returns(bool)',
  'function setApprovalForAll(address,bool)',
  'function safeTransferFrom(address,address,uint256,uint256,bytes)',
]);
export const worldItemsAbi = parseAbi([
  'function land() view returns(address)', 'function items() view returns(address)', 'function SCHEMA_VERSION() view returns(uint8)',
  'function getItems(uint256) view returns((address depositor,uint32 id,uint16 itemType,uint16 x,uint16 z,uint16 rotation,uint64 quantity)[])',
  'function placeItem(uint256,uint16,uint64,uint16,uint16,uint16) returns(uint32)',
  'function pickupItem(uint256,uint32)', 'function evictItem(uint256,uint32)',
  'error Unauthorized()', 'error InvalidPlacement()', 'error UnknownInstance()', 'error ParcelFull()', 'error UnsolicitedDeposit()',
]);
export const portalsAbi = parseAbi([
  'function land() view returns(address)', 'function SCHEMA_VERSION() view returns(uint8)',
  'function getPortals(uint256) view returns((uint32 id,uint16 destinationTokenId,uint16 x,uint16 z,uint16 rotation)[])',
  'function placePortal(uint256,uint16,uint16,uint16,uint16) returns(uint32)', 'function removePortal(uint256,uint32)',
  'error Unauthorized()', 'error InvalidPortal()', 'error UnknownPortal()',
]);
export class OnchainInventoryProvider implements ExperienceStore {
  readonly enabled: boolean;
  private client: OnchainParcelStateProvider['client']; private wallet: InjectedWallet;
  private addresses: {land:Address;items?:Address;worldItems?:Address;portals?:Address};
  constructor(client:OnchainParcelStateProvider['client'],wallet:InjectedWallet,addresses:OnchainInventoryProvider['addresses']) {this.client=client;this.wallet=wallet;this.addresses=addresses;this.enabled=!!(addresses.items&&addresses.worldItems&&addresses.portals);}
  async validateDeployment() {
    if(!this.enabled) {if(this.addresses.items||this.addresses.worldItems||this.addresses.portals)throw new Error('Configure all three item/portal contracts.');return;}
    const a=this.addresses;
    const values=await Promise.all([
      this.client.readContract({address:a.items!,abi:itemsAbi,functionName:'REGISTRY_VERSION'}),
      this.client.readContract({address:a.worldItems!,abi:worldItemsAbi,functionName:'land'}),
      this.client.readContract({address:a.worldItems!,abi:worldItemsAbi,functionName:'items'}),
      this.client.readContract({address:a.portals!,abi:portalsAbi,functionName:'land'}),
      this.client.readContract({address:a.worldItems!,abi:worldItemsAbi,functionName:'SCHEMA_VERSION'}),
      this.client.readContract({address:a.portals!,abi:portalsAbi,functionName:'SCHEMA_VERSION'}),
    ]);
    if(values[0]!==1||values[4]!==1||values[5]!==1||values[1].toLowerCase()!==a.land.toLowerCase()||values[2].toLowerCase()!==a.items!.toLowerCase()||values[3].toLowerCase()!==a.land.toLowerCase())throw new Error('Item/portal deployment mismatch');
  }
  private async write(address:Address|undefined,abi:Abi,functionName:string,args:readonly unknown[]) {
    if(!this.enabled||!address)throw new Error('Configure item and portal contract addresses first.');
    const wallet=await this.wallet.forChain(this.client.chain.id);
    const {request}=await this.client.simulateContract({address,abi,functionName,args,account:wallet.account});
    const fresh=await this.wallet.forChain(this.client.chain.id);
    if(fresh.account.address!==wallet.account.address)throw new Error('Wallet changed. Retry the action.');
    const hash=await fresh.writeContract({...request,chain:this.client.chain});
    const receipt=await this.client.waitForTransactionReceipt({hash});
    if(receipt.status!=='success')throw new Error('Transaction reverted');
  }
  async getBalance(address:Address,id:bigint) {itemDefinition(Number(id));if(!this.enabled)return 0n;return this.client.readContract({address:this.addresses.items!,abi:itemsAbi,functionName:'balanceOf',args:[address,id]});}
  async getInventory(address:Address) {
    const ids=ITEM_DEFINITIONS.map(i=>BigInt(i.id));
    const balances=this.enabled?await this.client.readContract({address:this.addresses.items!,abi:itemsAbi,functionName:'balanceOfBatch',args:[ids.map(()=>address),ids]}):ids.map(()=>0n);
    return ids.map((id,index)=>({itemId:Number(id),balance:balances[index]}));
  }
  async isEscrowApproved() {const account=this.wallet.snapshot.connectedAddress;return !!account&&this.enabled&&await this.client.readContract({address:this.addresses.items!,abi:itemsAbi,functionName:'isApprovedForAll',args:[account,this.addresses.worldItems!]});}
  async approveEscrow() {await this.write(this.addresses.items,itemsAbi,'setApprovalForAll',[this.addresses.worldItems,true]);}
  async transferItem(to:Address,id:number,quantity:bigint) {itemDefinition(id);if(quantity<=0n)throw new Error('Positive quantity required');const wallet=await this.wallet.forChain(this.client.chain.id);await this.write(this.addresses.items,itemsAbi,'safeTransferFrom',[wallet.account.address,to,BigInt(id),quantity,'0x']);}
  async getItems(tokenId:number):Promise<AttachedWorldItem[]> {if(!this.enabled)return [];const rows=await this.client.readContract({address:this.addresses.worldItems!,abi:worldItemsAbi,functionName:'getItems',args:[BigInt(tokenId)]});return rows.map(row=>({...row,parcelTokenId:tokenId}));}
  async getPortals(tokenId:number):Promise<Portal[]> {if(!this.enabled)return [];const rows=await this.client.readContract({address:this.addresses.portals!,abi:portalsAbi,functionName:'getPortals',args:[BigInt(tokenId)]});return rows.map(row=>({...row,parcelTokenId:tokenId}));}
  async placeItem(tokenId:number,item:ItemPlacement) {validateItemPlacement(item);if(!await this.isEscrowApproved())throw new Error('Approve item escrow in inventory first.');await this.write(this.addresses.worldItems,worldItemsAbi,'placeItem',[BigInt(tokenId),item.itemType,item.quantity,item.x,item.z,item.rotation]);}
  async pickupItem(tokenId:number,id:number) {await this.write(this.addresses.worldItems,worldItemsAbi,'pickupItem',[BigInt(tokenId),id]);}
  async evictItem(tokenId:number,id:number) {await this.write(this.addresses.worldItems,worldItemsAbi,'evictItem',[BigInt(tokenId),id]);}
  async placePortal(tokenId:number,portal:LocalTransform&{destinationTokenId:number}) {validatePortal(portal);await this.write(this.addresses.portals,portalsAbi,'placePortal',[BigInt(tokenId),portal.destinationTokenId,portal.x,portal.z,portal.rotation]);}
  async removePortal(tokenId:number,id:number) {await this.write(this.addresses.portals,portalsAbi,'removePortal',[BigInt(tokenId),id]);}
}
