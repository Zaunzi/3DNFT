import { isAddress, type Address } from 'viem';
import { ITEM_DEFINITIONS, type ItemDefinition } from './definitions.ts';
import type { ExperienceStore } from './providers.ts';
import type { WalletSession } from '../blockchain/wallet.ts';
import type { WalletItem } from './model.ts';
export class InventoryUI {
  open=false;busy=false;inventory:WalletItem[]=[];selected=3;
  private options:{characters?:()=>void;store:ExperienceStore;wallet:WalletSession;report:(message:string)=>void;onMode:(active:boolean)=>void;drop:(itemId:number,quantity:bigint)=>Promise<void>;use:(itemId:number)=>void;changed:()=>Promise<void>;trinkets?:{store:ExperienceStore;definitions:readonly ItemDefinition[];drop:(id:number,quantity:bigint)=>Promise<void>}};
  collectionIndex=0;
  private get store(){return this.collectionIndex===1?this.options.trinkets!.store:this.options.store;}
  private get definitions(){return this.collectionIndex===1?this.options.trinkets!.definitions:ITEM_DEFINITIONS;}
  private panel:HTMLElement;private abort=new AbortController();private request=0;
  constructor(options:InventoryUI['options']){this.options=options;this.panel=document.createElement('section');this.panel.className='inventory-panel';this.panel.hidden=true;
    this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Inventory');
    this.panel.innerHTML=`<div class="menu-heading"><div><div class="menu-kicker">YOUR COLLECTION</div><h2>Inventory</h2><p>Carry it. Place it. Make it yours.</p></div><button id="close-inventory" class="menu-close" aria-label="Close inventory">×</button></div><div class="menu-body"><div class="inventory-tools"><label>Collection<select id="inventory-collection"><option value="0">Parcel Items</option>${options.trinkets?'<option value="1">Trinkets</option>':''}</select></label><button id="inventory-refresh" class="secondary-action">Refresh</button>${options.characters?'<button id="inventory-characters" class="secondary-action">Characters & NFTs ↗</button>':''}</div><div class="inventory-list" aria-label="Items"></div><section class="menu-card"><div class="menu-kicker">SELECTED ITEM</div><p id="item-description"></p><label>Quantity <input id="item-quantity" type="number" min="1" max="1000000" value="1"></label><div class="inventory-actions"><button id="drop-item">Place near me</button><button id="use-item" class="secondary-action">Inspect</button><button id="approve-items" class="secondary-action">Approve item escrow</button>${options.store.grantDevItem?'<button id="grant-item" class="secondary-action">Dev: give item</button>':''}</div></section><details class="menu-card"><summary>Send to another wallet</summary><p class="menu-note">Transfer the selected item and quantity.</p><label>Recipient address<input id="item-recipient" placeholder="0x…"></label><button id="transfer-item" class="secondary-action">Transfer item</button></details></div><p class="inventory-status menu-status" role="status"></p>`;
    document.getElementById('app')!.append(this.panel);const signal=this.abort.signal;
    this.panel.querySelector('#inventory-collection')!.addEventListener('change',()=>{this.collectionIndex=Number((this.panel.querySelector('#inventory-collection') as HTMLSelectElement).value);this.selected=1;void this.refresh();},{signal});
    this.panel.querySelector('#inventory-characters')?.addEventListener('click',()=>options.characters?.(),{signal});
    const action=(id:string,fn:()=>Promise<void>)=>this.panel.querySelector(id)?.addEventListener('click',()=>{void this.run(fn);},{signal});
    action('#drop-item',()=>(this.collectionIndex===1?options.trinkets!.drop:options.drop)(this.selected,this.quantity()));
    action('#approve-items',()=>this.store.approveEscrow());
    action('#grant-item',()=>this.store.grantDevItem!(this.selected,this.quantity()));
    action('#transfer-item',async()=>{const address=(this.panel.querySelector('#item-recipient')as HTMLInputElement).value.trim();if(!isAddress(address))throw new Error('Enter a valid recipient address.');await this.store.transferItem(address as Address,this.selected,this.quantity());});
    action('#inventory-refresh',()=>this.refresh());
    this.panel.querySelector('#use-item')!.addEventListener('click',()=>{try{if(!this.inventory.some(e=>e.itemId===this.selected&&e.balance>0n))throw new Error('You do not own this item.');if(this.collectionIndex===1)options.report(this.definitions.find(d=>d.id===this.selected)!.description);else options.use(this.selected);}catch(error){options.report(String(error));}},{signal});
    this.panel.querySelector('#close-inventory')!.addEventListener('click',()=>this.setOpen(false),{signal});
    window.addEventListener('keydown',event=>{if(event.repeat||event.target instanceof Element&&event.target.matches('input,textarea,select'))return;if(event.code==='KeyI'){event.preventDefault();this.setOpen(!this.open);}if(event.code==='Escape'&&this.open){event.preventDefault();this.setOpen(false);}},{signal});
  }
  private quantity(){const raw=(this.panel.querySelector('#item-quantity')as HTMLInputElement).value;if(!/^[1-9]\d*$/.test(raw))throw new Error('Enter a positive integer quantity.');const q=BigInt(raw);if(q>1000000n)throw new Error('Maximum quantity is 1,000,000.');return q;}
  setOpen(open:boolean){if(this.busy)return;this.open=open;this.panel.hidden=!open;this.options.onMode(open);if(open)void this.refresh();}
  async refresh(){const request=++this.request,address=this.options.wallet.snapshot.connectedAddress;this.inventory=[];this.draw();if(!address){this.status('Connect a wallet to see its inventory.');return;}try{const inventory=await this.store.getInventory(address);if(request!==this.request||this.options.wallet.snapshot.connectedAddress!==address)return;this.inventory=inventory;this.draw();this.status(this.store.enabled?'':'Placement is not enabled for this collection yet.');}catch(error){if(request===this.request)this.status(String(error));}}
  private status(text:string){this.panel.querySelector('.inventory-status')!.textContent=text;}
  private draw(){const list=this.panel.querySelector('.inventory-list')!;list.replaceChildren();for(const item of this.definitions){const button=document.createElement('button');const balance=this.inventory.find(e=>e.itemId===item.id)?.balance??0n;
    const name=document.createElement('strong');name.textContent=item.name;
    const count=document.createElement('span');count.className='item-count';count.textContent=String(balance);
    const hint=document.createElement('small');hint.textContent=balance>0n?'IN YOUR WALLET':'NOT OWNED';
    button.append(count,name,hint);button.setAttribute('aria-pressed',String(item.id===this.selected));button.classList.toggle('chosen',item.id===this.selected);button.disabled=this.busy;button.addEventListener('click',()=>{this.selected=item.id;this.draw();});list.append(button);}this.panel.querySelector('#item-description')!.textContent=this.definitions.find(d=>d.id===this.selected)!.description;this.panel.querySelector('#approve-items')!.textContent=this.collectionIndex===1?'Approve Trinket escrow':'Approve item escrow';(this.panel.querySelector('#approve-items')as HTMLButtonElement).hidden=!!this.store.grantDevItem;}
  private async run(action:()=>Promise<void>){if(this.busy)return;this.busy=true;this.panel.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(button=>button.disabled=true);this.status('Working… approve the wallet request if prompted.');try{await action();await this.options.changed();await this.refresh();this.status('Confirmed.');}catch(error){this.status(error instanceof Error?error.message.slice(0,300):String(error));}finally{this.busy=false;this.panel.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(button=>button.disabled=false);this.draw();}}
  dispose(){this.request++;this.abort.abort();this.panel.remove();}
}
