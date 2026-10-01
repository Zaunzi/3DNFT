import { BaseError, ContractFunctionRevertedError, parseAbi, type Abi, type Address } from 'viem';
import type { OnchainParcelStateProvider } from '../blockchain/client.ts';
import type { InjectedWallet } from '../blockchain/wallet.ts';
import { ITEM_DEFINITIONS, itemDefinition } from './definitions.ts';
import { validateItemPlacement, validatePortal, type ItemPlacement, type LocalTransform, type Portal, type AttachedWorldItem } from './model.ts';
import type { ExperienceStore } from '../items/providers.ts';
import {itemsAbi,worldItemsAbi} from '../items/onchainInventory.ts';
export class OnchainTrinketProvider implements ExperienceStore {
  readonly enabled: boolean;
  private client: OnchainParcelStateProvider['client']; private wallet: InjectedWallet;
  private addresses: {land:Address;items?:Address;worldItems?:Address;portals?:Address};
  constructor(client:OnchainParcelStateProvider['client'],wallet:InjectedWallet,addresses:OnchainTrinketProvider['addresses']) {this.client=client;this.wallet=wallet;this.addresses=addresses;this.enabled=!!(addresses.items&&addresses.worldItems);}
  async validateDeployment() {
    if(!this.enabled) return;
    const a=this.addresses;
    const [land,items,schema]=await Promise.all([
      this.client.readContract({address:a.worldItems!,abi:worldItemsAbi,functionName:'land'}),
      this.client.readContract({address:a.worldItems!,abi:worldItemsAbi,functionName:'items'}),
      this.client.readContract({address:a.worldItems!,abi:worldItemsAbi,functionName:'SCHEMA_VERSION'}),
    ]);
    if(schema!==1||land.toLowerCase()!==a.land.toLowerCase()||items.toLowerCase()!==a.items!.toLowerCase())throw new Error('Trinket escrow deployment mismatch');
  }
  private async write(address:Address|undefined,abi:Abi,functionName:string,args:readonly unknown[]) {
    if(!this.enabled||!address)throw new Error('Trinket placement is not deployed yet.');
    const wallet=await this.wallet.forChain(this.client.chain.id);
    let simulation;
    try { simulation=await this.client.simulateContract({address,abi,functionName,args,account:wallet.account}); }
    catch(error) {
      const revert=error instanceof BaseError?error.walk(e=>e instanceof ContractFunctionRevertedError):undefined;
      if(revert instanceof ContractFunctionRevertedError&&revert.data?.errorName==='ERC721NonexistentToken') {
        const missing=String(revert.data.args?.[0]);
        throw new Error(`Parcel #${missing} has not been minted. Choose a minted destination or mint that parcel first. Portal Cores are not required or consumed in this version.`);
      }
      throw error;
    }
    const {request}=simulation;
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
  async getPortals(_tokenId:number):Promise<Portal[]> {return [];}
  async placeItem(tokenId:number,item:ItemPlacement) {validateItemPlacement(item);if(!await this.isEscrowApproved())throw new Error('Approve item escrow in inventory first.');await this.write(this.addresses.worldItems,worldItemsAbi,'placeItem',[BigInt(tokenId),item.itemType,item.quantity,item.x,item.z,item.rotation]);}
  async pickupItem(tokenId:number,id:number) {await this.write(this.addresses.worldItems,worldItemsAbi,'pickupItem',[BigInt(tokenId),id]);}
  async evictItem(tokenId:number,id:number) {await this.write(this.addresses.worldItems,worldItemsAbi,'evictItem',[BigInt(tokenId),id]);}
  async placePortal(){throw new Error('Trinkets do not create portals');}
  async removePortal(){throw new Error('Trinkets do not create portals');}
}
