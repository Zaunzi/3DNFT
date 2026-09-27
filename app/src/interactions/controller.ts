import * as THREE from 'three';
import { INTERACTION_DISTANCE } from '../items/model.ts';
export interface InteractionContext { connected:boolean;canEdit(tokenId:number):boolean }
export interface Interactable { id:string;type:string;getInteractionLabel():string;canInteract(context:InteractionContext):boolean;interact(context:InteractionContext):Promise<void> }
export class InteractionController {
  focused:Interactable|null=null;pending=false;
  private options:{camera:THREE.Camera;roots:()=>THREE.Object3D[];occluders:()=>THREE.Object3D[];resolve:(object:THREE.Object3D)=>Interactable|null;context:()=>InteractionContext;enabled:()=>boolean;report:(message:string)=>void;label:HTMLElement};
  private ray=new THREE.Raycaster();private abort=new AbortController();
  constructor(options:InteractionController['options']){this.options=options;window.addEventListener('keydown',event=>{if(event.code==='KeyE'&&!event.repeat&&!(event.target instanceof Element&&event.target.matches('input,textarea,select'))){event.preventDefault();void this.activate();}},{signal:this.abort.signal});}
  update(){const o=this.options;this.focused=null;o.label.textContent='';if(!o.enabled()||this.pending)return;o.camera.updateMatrixWorld();this.ray.setFromCamera(new THREE.Vector2(0,0),o.camera);this.ray.far=INTERACTION_DISTANCE;
    const hit=this.ray.intersectObjects(o.roots(),true)[0];if(!hit)return;const blocked=this.ray.intersectObjects(o.occluders(),true)[0];if(blocked&&blocked.distance<hit.distance-.02)return;
    let object:THREE.Object3D|null=hit.object;while(object&&!this.focused){this.focused=o.resolve(object);object=object.parent;}
    if(this.focused)o.label.textContent=this.focused.canInteract(o.context())?`[E] ${this.focused.getInteractionLabel()}`:`${this.focused.getInteractionLabel()} · Connect the current parcel owner`;
  }
  private async activate(){if(this.pending)return;this.update();const target=this.focused;if(!target||!target.canInteract(this.options.context()))return;this.pending=true;try{await target.interact(this.options.context());}catch(error){this.options.report(error instanceof Error?error.message.slice(0,240):String(error));}finally{this.pending=false;}}
  dispose(){this.abort.abort();}
}
