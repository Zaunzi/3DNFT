import {INTERACTION_DISTANCE} from '../items/model.ts';
import * as THREE from 'three';
import type {WorldManager} from '../world/worldManager.ts';
import type {HarvestProvider,Resource} from './model.ts';
import {RESERVE_CAP} from './model.ts';
interface Options {provider:HarvestProvider;world:WorldManager;camera:THREE.Camera;enabled():boolean;canHarvest(id:number):boolean;token():number;occluders():THREE.Object3D[];report(message:string):void;changed():Promise<void>}
export class HarvestRuntime {
 private options:Options;private ray=new THREE.Raycaster();private target:{parcel:number;resource:Resource}|null=null;private busy=false;private abort=new AbortController();private label=document.createElement('div');private hud=document.createElement('p');private next=0;
 constructor(options:Options){this.options=options;this.label.className='harvest-label';this.label.setAttribute('role','status');this.hud.className='harvest-hud';document.getElementById('app')!.append(this.label,this.hud);
 window.addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||e.target instanceof Element&&e.target.matches('input,textarea,select,[contenteditable]'))return;this.update(true);if(!this.target||!options.enabled()||this.busy)return;e.preventDefault();const target=this.target;this.busy=true;void options.provider.harvest(target.parcel,target.resource).then(async amount=>{options.report(`Harvested +${amount} ${target.resource} from parcel #${target.parcel}.`);await options.changed();}).catch(error=>options.report(String(error))).finally(()=>{this.busy=false;this.next=0;});},{signal:this.abort.signal});}
 update(force=false){if(!force&&performance.now()<this.next)return;this.next=performance.now()+200;const o=this.options;this.target=null;this.label.textContent='';
 try{const reserves=o.provider.reserves(o.token());this.hud.textContent=`MOCK RESERVES · #${o.token()} · Wood ${reserves.wood.available}/${RESERVE_CAP} · Stone ${reserves.stone.available}/${RESERVE_CAP} · +1 / 30s`;if(!o.enabled())return;
 const roots=[...o.world.parcels.values()].map(p=>p.group);o.camera.updateMatrixWorld();this.ray.setFromCamera(new THREE.Vector2(),o.camera);this.ray.far=INTERACTION_DISTANCE;
 const hit=this.ray.intersectObjects([...roots,...o.occluders()],true)[0];if(!hit||hit.object.userData.kind!=='harvest-scenery')return;
 const parcel=hit.object.userData.parcel as number,resource=hit.object.userData.resource as Resource;
 if(!o.canHarvest(parcel)){this.label.textContent='Harvesting requires the current parcel owner';return;}
 const reserve=o.provider.reserves(parcel)[resource];this.target={parcel,resource};this.label.textContent=this.busy?'Harvesting…':`[F] ${resource==='wood'?'Chop tree':'Mine rock'} · ${reserve.available} ${resource} available · shared parcel reserve`;
 }catch{this.hud.textContent='Mock resource data unavailable';}}
 dispose(){this.abort.abort();this.label.remove();this.hud.remove();}
}
