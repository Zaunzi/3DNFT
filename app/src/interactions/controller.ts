import * as THREE from 'three';
import { INTERACTION_DISTANCE } from '../items/model.ts';
export interface InteractionContext { connected:boolean;canEdit(tokenId:number):boolean }
export interface Interactable { id:string;type:string;getInteractionLabel():string;canInteract(context:InteractionContext):boolean;interact(context:InteractionContext):Promise<void>;play?():void;playLabel?:string }
export class InteractionController {
  focused:Interactable|null=null;pending=false;
  private options:{canvas?:HTMLCanvasElement;camera:THREE.Camera;origin?:()=>THREE.Vector3;roots:()=>THREE.Object3D[];occluders:()=>THREE.Object3D[];resolve:(object:THREE.Object3D)=>Interactable|null;context:()=>InteractionContext;enabled:()=>boolean;report:(message:string)=>void;label:HTMLElement};
  private ray=new THREE.Raycaster();private abort=new AbortController();
  constructor(options:InteractionController['options']){this.options=options;
    let motion=0,down=false;
    const signal=this.abort.signal;
    options.canvas?.addEventListener('pointerdown',e=>{down=e.button===0;motion=0;},{signal});
    options.canvas?.addEventListener('pointermove',e=>{if(down)motion+=Math.hypot(e.movementX,e.movementY);},{signal});
    options.canvas?.addEventListener('pointercancel',()=>{down=false;},{signal});
    options.canvas?.addEventListener('pointerup',e=>{const click=down&&e.button===0&&motion<6;down=false;if(click){this.update();this.focused?.play?.();}},{signal});
window.addEventListener('keydown',event=>{if(event.code==='KeyE'&&!event.repeat&&!(event.target instanceof Element&&event.target.matches('input,textarea,select'))){event.preventDefault();void this.activate();}},{signal:this.abort.signal});}
  update(){const o=this.options;this.focused=null;o.label.textContent='';if(!o.enabled()||this.pending)return;o.camera.updateMatrixWorld();this.ray.setFromCamera(new THREE.Vector2(0,0),o.camera);const origin=o.origin?.()??o.camera.position;this.ray.far=INTERACTION_DISTANCE+this.ray.ray.origin.distanceTo(origin);
    const hit=this.ray.intersectObjects(o.roots(),true)[0];if(!hit||hit.point.distanceTo(origin)>INTERACTION_DISTANCE)return;const blocked=this.ray.intersectObjects(o.occluders(),true)[0];if(blocked&&blocked.distance<hit.distance-.02)return;
    // A third-person camera can see around a corner the player cannot reach.
    const reach=new THREE.Raycaster(origin,hit.point.clone().sub(origin).normalize(),.02,Math.max(0,origin.distanceTo(hit.point)-.02));
    if(reach.intersectObjects(o.occluders(),true).length)return;
    let object:THREE.Object3D|null=hit.object;while(object&&!this.focused){this.focused=o.resolve(object);object=object.parent;}
    if(this.focused)o.label.textContent=this.focused.canInteract(o.context())?`[E] ${this.focused.getInteractionLabel()}`:`${this.focused.getInteractionLabel()} · Connect the current parcel owner`;
    if(this.focused?.play)o.label.textContent=`[Left click] ${this.focused.playLabel??'Play instrument'} · ${o.label.textContent}`;
  }
  private async activate(){if(this.pending)return;this.update();const target=this.focused;if(!target||!target.canInteract(this.options.context()))return;this.pending=true;try{await target.interact(this.options.context());}catch(error){this.options.report(error instanceof Error?error.message.slice(0,240):String(error));}finally{this.pending=false;}}
  dispose(){this.abort.abort();}
}
