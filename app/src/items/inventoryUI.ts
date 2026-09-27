import { isAddress, type Address } from 'viem';
import { ITEM_DEFINITIONS, itemDefinition } from './definitions.ts';
import type { ExperienceStore } from './providers.ts';
import type { WalletSession } from '../blockchain/wallet.ts';
import type { WalletItem } from './model.ts';
export class InventoryUI {
  open=false;busy=false;inventory:WalletItem[]=[];selected=3;
  private options:{store:ExperienceStore;wallet:WalletSession;report:(message:string)=>void;onMode:(active:boolean)=>void;drop:(itemId:number,quantity:bigint)=>Promise<void>;use:(itemId:number)=>void;changed:()=>Promise<void>};
  private panel:HTMLElement;private abort=new AbortController();private request=0;
  constructor(options:InventoryUI['options']){this.options=options;this.panel=document.createElement('section');this.panel.className='inventory-panel';this.panel.hidden=true;
    this.panel.innerHTML=`<div class="eyebrow">WALLET INVENTORY</div><div class="inventory-list"></div><p id="item-description"></p><label>Quantity <input id="item-quantity" type="number" min="1" max="1000000" value="1"></label><div class="inventory-actions"><button id="drop-item">Place near player</button><button id="use-item">Use / inspect</button><button id="approve-items">Approve item escrow</button>${options.store.grantDevItem?'<button id="grant-item">DEV: give selected item</button>':''}<button id="inventory-refresh">Refresh inventory</button></div><label>Recipient <input id="item-recipient" placeholder="0x…"></label><button id="transfer-item">Transfer selected quantity</button><button id="close-inventory">Close [I / Esc]</button><p class="inventory-status" role="status"></p>`;
    document.getElementById('app')!.append(this.panel);const signal=this.abort.signal;
    const action=(id:string,fn:()=>Promise<void>)=>this.panel.querySelector(id)?.addEventListener('click',()=>{void this.run(fn);},{signal});
    action('#drop-item',()=>options.drop(this.selected,this.quantity()));
    action('#approve-items',()=>options.store.approveEscrow());
    action('#grant-item',()=>options.store.grantDevItem!(this.selected,this.quantity()));
    action('#transfer-item',async()=>{const address=(this.panel.querySelector('#item-recipient')as HTMLInputElement).value.trim();if(!isAddress(address))throw new Error('Enter a valid recipient address.');await options.store.transferItem(address as Address,this.selected,this.quantity());});
    action('#inventory-refresh',()=>this.refresh());
    this.panel.querySelector('#use-item')!.addEventListener('click',()=>{try{if(!this.inventory.some(e=>e.itemId===this.selected&&e.balance>0n))throw new Error('You do not own this item.');options.use(this.selected);}catch(error){options.report(String(error));}},{signal});
    this.panel.querySelector('#close-inventory')!.addEventListener('click',()=>this.setOpen(false),{signal});
    window.addEventListener('keydown',event=>{if(event.repeat||event.target instanceof Element&&event.target.matches('input,textarea,select'))return;if(event.code==='KeyI'){event.preventDefault();this.setOpen(!this.open);}if(event.code==='Escape'&&this.open){event.preventDefault();this.setOpen(false);}},{signal});
  }
  private quantity(){const raw=(this.panel.querySelector('#item-quantity')as HTMLInputElement).value;if(!/^[1-9]\d*$/.test(raw))throw new Error('Enter a positive integer quantity.');const q=BigInt(raw);if(q>1000000n)throw new Error('Maximum quantity is 1,000,000.');return q;}
  setOpen(open:boolean){if(this.busy)return;this.open=open;this.panel.hidden=!open;this.options.onMode(open);if(open)void this.refresh();}
  async refresh(){const request=++this.request,address=this.options.wallet.snapshot.connectedAddress;this.inventory=[];this.draw();if(!address){this.status('Connect a wallet to see its inventory.');return;}try{const inventory=await this.options.store.getInventory(address);if(request!==this.request||this.options.wallet.snapshot.connectedAddress!==address)return;this.inventory=inventory;this.draw();this.status(this.options.store.enabled?'':'Configure item/portal contracts to enable this inventory.');}catch(error){if(request===this.request)this.status(String(error));}}
  private status(text:string){this.panel.querySelector('.inventory-status')!.textContent=text;}
  private draw(){const list=this.panel.querySelector('.inventory-list')!;list.replaceChildren();for(const item of ITEM_DEFINITIONS){const button=document.createElement('button');button.textContent=`${item.name} × ${this.inventory.find(e=>e.itemId===item.id)?.balance??0n}`;button.classList.toggle('chosen',item.id===this.selected);button.disabled=this.busy;button.addEventListener('click',()=>{this.selected=item.id;this.draw();});list.append(button);}this.panel.querySelector('#item-description')!.textContent=itemDefinition(this.selected).description;(this.panel.querySelector('#approve-items')as HTMLButtonElement).hidden=!!this.options.store.grantDevItem;}
  private async run(action:()=>Promise<void>){if(this.busy)return;this.busy=true;this.panel.querySelectorAll('button').forEach(button=>button.disabled=true);this.status('Working… approve the wallet request if prompted.');try{await action();await this.options.changed();await this.refresh();this.status('Confirmed.');}catch(error){this.status(error instanceof Error?error.message.slice(0,300):String(error));}finally{this.busy=false;this.panel.querySelectorAll('button').forEach(button=>button.disabled=false);this.draw();}}
  dispose(){this.request++;this.abort.abort();this.panel.remove();}
}
