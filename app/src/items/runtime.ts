import {InstrumentPlayer} from '../trinkets/playback.ts';
import {TrinketRegistry} from '../trinkets/rendering.ts';
import {ITEM_DEFINITIONS as TRINKET_DEFINITIONS, itemDefinition as trinketDefinition} from '../trinkets/definitions.ts';
import {validateItemPlacement as validateTrinket} from '../trinkets/model.ts';
import * as THREE from 'three';
import type { createBackend } from '../blockchain/backend.ts';
import type { WorldManager } from '../world/worldManager.ts';
import type { PersistentObjectLayer } from '../objects/persistentLayer.ts';
import type { Player } from '../player/player.ts';
import type { BuildController } from '../build/buildController.ts';
import { OBJECT_TYPES, objectToWorldPosition, worldToObjectPosition } from '../objects/model.ts';
import { tokenIdToCoordinate } from '../world/coordinates.ts';
import { getVegetation } from '../world/vegetation.ts';
import { ExperienceLayer, ExperienceRegistry } from './rendering.ts';
import { InventoryUI } from './inventoryUI.ts';
import { itemDefinition } from './definitions.ts';
import { validateItemPlacement, type Portal, type AttachedWorldItem } from './model.ts';
import { InteractionController } from '../interactions/controller.ts';
import { PortalNavigator } from '../portals/navigation.ts';
import { findSafeSpawnPosition } from '../portals/spawn.ts';
import { resolveInternalDestination, type NFTWorldLocation } from '../portals/location.ts';

interface RuntimeOptions {
  backend:Awaited<ReturnType<typeof createBackend>>;scene:THREE.Scene;camera:THREE.PerspectiveCamera;world:WorldManager;objects:PersistentObjectLayer;player:Player;
  openCharacters?():void;
  placeTrinket?(itemType:number,quantity:bigint):Promise<void>;
  token():number;canEdit(tokenId:number):boolean;builder():BuildController|undefined;
  commit(location:NFTWorldLocation,position:{x:number;y:number;z:number},url:string):void;
  report(message:string):void;modalChanged(active:boolean):void; blocked?():boolean;extraOccluders?():THREE.Object3D[];extraObstacles?(tokenId:number):Promise<{x:number;z:number;radius:number}[]>;
}
export class ItemPortalRuntime {
  readonly trinketLayer:ExperienceLayer;private trinketRegistry=new TrinketRegistry();
  readonly layer:ExperienceLayer;readonly inventory:InventoryUI;readonly navigation:PortalNavigator;
  readonly instrumentPlayer:InstrumentPlayer;
  get open(){return this.inventory.open||this.instrumentPlayer.open;}
  closePanels(){this.inventory.setOpen(false);this.instrumentPlayer.close();}
  private registry=new ExperienceRegistry();private interactions:InteractionController;private options:RuntimeOptions;
  private stopTrinkets:(()=>void)|undefined;
  private stopWallet:()=>void;private stopStore:(()=>void)|undefined;private light=new THREE.PointLight(0xffd599,0,16,2);
  private label:HTMLElement;private toolbar:HTMLElement;private lanternOn=false;
  constructor(options:RuntimeOptions){
    this.options=options;const o=options,store=o.backend.experience;
    this.instrumentPlayer=new InstrumentPlayer(active=>o.modalChanged(active));
    this.layer=new ExperienceLayer(o.scene,store,this.registry,o.world.seed,o.report);o.scene.add(this.light);
    this.trinketLayer=new ExperienceLayer(o.scene,o.backend.trinkets,this.trinketRegistry,o.world.seed,o.report,'trinket');
    this.toolbar=document.createElement('div');this.toolbar.className='experience-toolbar';this.toolbar.innerHTML='<button id="open-inventory">Inventory [I]</button><button id="portal-back" disabled>Return through portal</button>';
    document.getElementById('app')!.append(this.toolbar);this.label=document.createElement('div');this.label.className='interaction-label';this.label.setAttribute('role','status');document.getElementById('app')!.append(this.label);
    this.navigation=new PortalNavigator({current:()=>this.location(),currentURL:()=>new URL(location.href),prepare:id=>this.prepare(id),commit:(location,spawn,url)=>{o.commit(location,spawn,url);this.sync();}},o.world.seed);
    this.inventory=new InventoryUI({characters:o.openCharacters,store,trinkets:{store:o.backend.trinkets,definitions:TRINKET_DEFINITIONS,drop:async(itemType,quantity)=>{
      if(o.placeTrinket)return o.placeTrinket(itemType,quantity);
      if(!o.canEdit(o.token()))throw new Error('Only the parcel owner may attach trinkets.');
      const direction=o.camera.getWorldDirection(new THREE.Vector3());direction.y=0;direction.normalize();const position=o.player.camera.position.clone().addScaledVector(direction,4);
      const item={itemType,quantity,...worldToObjectPosition(o.token(),position.x,position.z),rotation:0};validateTrinket(item);await o.backend.trinkets.placeItem(o.token(),item);
    }},wallet:o.backend.wallet,report:o.report,onMode:active=>{if(active)this.instrumentPlayer.close();if(active&&o.builder()?.active)o.builder()!.setActive(false);o.modalChanged(active);},
      drop:async(itemType,quantity)=>{if(!o.canEdit(o.token()))throw new Error('Only the parcel owner may attach items.');const direction=o.camera.getWorldDirection(new THREE.Vector3());direction.y=0;direction.normalize();const position=o.player.camera.position.clone().addScaledVector(direction,3);const item={itemType,quantity,...worldToObjectPosition(o.token(),position.x,position.z),rotation:0};validateItemPlacement(item);await store.placeItem(o.token(),item);},
      use:item=>{if(item===5){this.lanternOn=!this.lanternOn;o.report(this.lanternOn?'Lantern on':'Lantern off');}else o.report(itemDefinition(item).description);},changed:()=>this.refresh(),
    });
    this.toolbar.querySelector('#open-inventory')!.addEventListener('click',()=>o.openCharacters?.());
    this.toolbar.querySelector('#portal-back')!.addEventListener('click',()=>{void this.travelBack();});
    this.interactions=new InteractionController({canvas:o.player.controls.domElement instanceof HTMLCanvasElement ? o.player.controls.domElement : undefined,camera:o.camera,origin:()=>o.player.camera.position,roots:()=>[...this.layer.roots(),...this.trinketLayer.roots()],occluders:()=>[...[...o.world.parcels.values()].map(p=>p.terrain),...o.objects.roots(),...(o.extraOccluders?.()??[])],context:()=>({connected:o.backend.wallet.snapshot.isConnected,canEdit:o.canEdit}),enabled:()=>o.player.active&&!o.builder()?.active&&!this.open&&!this.navigation.busy&&!o.blocked?.(),
      label:this.label,report:o.report,resolve:object=>{
        if(object.userData.kind==='trinket'){const item=object.userData.entity as AttachedWorldItem;return {id:`trinket:${item.parcelTokenId}:${item.id}`,type:'item',playLabel:`Play ${trinketDefinition(item.itemType).name}`,play:()=>this.instrumentPlayer.play(item.itemType),getInteractionLabel:()=>`Pick up ${trinketDefinition(item.itemType).name}`,canInteract:context=>context.connected&&context.canEdit(item.parcelTokenId),interact:async()=>{await o.backend.trinkets.pickupItem(item.parcelTokenId,item.id);await this.trinketLayer.refresh(item.parcelTokenId);await this.inventory.refresh();}};}
        if(object.userData.kind==='item'){const item=object.userData.entity as AttachedWorldItem;return {id:`${item.parcelTokenId}:${item.id}`,type:'item',getInteractionLabel:()=>`Pick up ${itemDefinition(item.itemType).name} × ${item.quantity}`,canInteract:context=>context.connected&&context.canEdit(item.parcelTokenId),interact:async()=>{await store.pickupItem(item.parcelTokenId,item.id);await this.layer.refresh(item.parcelTokenId);await this.inventory.refresh();}};}
        if(object.userData.kind==='portal'){const portal=object.userData.entity as Portal;return {id:`${portal.parcelTokenId}:${portal.id}`,type:'portal',getInteractionLabel:()=>`Enter Portal → Parcel #${portal.destinationTokenId}`,canInteract:()=>true,interact:async()=>{const current=await store.getPortals(portal.parcelTokenId);const fresh=current.find(p=>p.id===portal.id);if(!fresh)throw new Error('Portal no longer exists');const destination=resolveInternalDestination({kind:'INTERNAL_ATLAS',tokenId:BigInt(fresh.destinationTokenId)},this.location());await this.travel(destination);}};}
        return null;
      }});
    this.stopWallet=o.backend.wallet.subscribe(()=>{this.lanternOn=false;void this.inventory.refresh();});
    this.stopTrinkets=o.backend.trinkets.subscribe?.(()=>{void this.refresh();});
    this.stopStore=store.subscribe?.(()=>{void this.refresh();});
  }
  location():NFTWorldLocation {return {chainId:this.options.backend.config.chainId,contractAddress:this.options.backend.config.land??'0x0000000000000000000000000000000000000000',tokenId:BigInt(this.options.token())};}
  private async prepare(tokenId:number){const o=this.options;tokenIdToCoordinate(tokenId);const [parcel,objects,items,portals]=await Promise.all([o.backend.world.getParcel(tokenId),o.backend.objects.getObjects(BigInt(tokenId)),o.backend.experience.getItems(tokenId),o.backend.experience.getPortals(tokenId)]);
    const trinkets=await o.backend.trinkets.getItems(tokenId);
    const obstacles=[...trinkets.map(item=>({...objectToWorldPosition(tokenId,item),radius:2})),...objects.map(object=>({...objectToWorldPosition(tokenId,object),radius:OBJECT_TYPES[object.objectType].radius/100})),...items.map(item=>({...objectToWorldPosition(tokenId,item),radius:1})),...portals.map(portal=>({...objectToWorldPosition(tokenId,portal),radius:2})),...getVegetation(tokenIdToCoordinate(tokenId),o.world.seed).map(d=>({x:d.x,z:d.z,radius:d.scale*(d.kind==='tree'?1.8:.9)}))];obstacles.push(...await o.extraObstacles?.(tokenId)??[]);return {exists:parcel.owner!==null,obstacles};}
  async initializeSpawn(){const data=await this.prepare(this.options.token());const spawn=findSafeSpawnPosition(this.options.token(),this.options.world.seed,data.obstacles);this.options.camera.position.set(spawn.x,spawn.y,spawn.z);this.sync();}
  private async travel(location:NFTWorldLocation){const active=this.options.player.active;this.options.player.active=false;try{await this.navigation.travel(location);this.options.report(`Arrived in parcel #${location.tokenId}`);}finally{this.options.player.active=active;}}
  private async travelBack(){if(this.inventory.busy||this.options.builder()?.pending)return;const active=this.options.player.active;this.options.player.active=false;try{await this.navigation.back();this.options.report('Returned through portal');}catch(error){this.options.report(String(error));}finally{this.options.player.active=active;}}
  sync(){this.layer.sync(this.options.world.parcels.keys());this.trinketLayer.sync(this.options.world.parcels.keys());}
  async refresh(){await Promise.all([...this.options.world.parcels.keys()].flatMap(id=>[this.layer.refresh(id),this.trinketLayer.refresh(id)]));await this.inventory.refresh();}
  portals(){return {createPreview:()=>this.registry.portal(),roots:()=>this.layer.portalRoots(),find:(tokenId:number,id:number)=>this.layer.portalRoots().find(object=>object.userData.entity.parcelTokenId===tokenId&&object.userData.entity.id===id),count:(tokenId:number)=>this.layer.parcels.get(tokenId)?.portals.length??0,
    place:async(tokenId:number,portal:Parameters<ExperienceStorePlace>[1])=>{await this.options.backend.experience.placePortal(tokenId,portal);await this.layer.refresh(tokenId);},remove:async(tokenId:number,id:number)=>{await this.options.backend.experience.removePortal(tokenId,id);await this.layer.refresh(tokenId);}};}
  update(){this.interactions.update();this.light.position.copy(this.options.camera.position);this.light.intensity=this.lanternOn&&this.inventory.collectionIndex===0&&this.inventory.inventory.some(e=>e.itemId===5&&e.balance>0n)?4:0;(this.toolbar.querySelector('#portal-back')as HTMLButtonElement).disabled=this.navigation.stack.length===0||this.navigation.busy;}
  debug(){const focused=this.interactions.focused;return `\nINVENTORY   ${this.inventory.inventory.reduce((sum,e)=>sum+e.balance,0n)}\nFOCUS       ${focused?.type??'none'} ${focused?.id??''}\nINTERACTION ${focused?.getInteractionLabel()??'—'}\nITEMS       ${this.layer.count('items')}\nTRINKETS    ${this.trinketLayer.count('items')}\nPORTALS     ${this.layer.count('portals')}\nLOCATION    ${this.location().chainId}:${this.location().contractAddress}:#${this.options.token()}`;}
  dispose(){this.stopWallet();this.stopStore?.();this.stopTrinkets?.();this.instrumentPlayer.dispose();this.inventory.dispose();this.interactions.dispose();this.layer.dispose();this.trinketLayer.dispose();this.trinketRegistry.dispose();this.registry.dispose();this.light.removeFromParent();this.label.remove();this.toolbar.remove();}
}
type ExperienceStorePlace = import('./providers.ts').ExperienceStore['placePortal'];
