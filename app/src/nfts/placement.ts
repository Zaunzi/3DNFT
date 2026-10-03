import * as THREE from 'three';
import { worldToObjectPosition, objectToWorldPosition } from '../objects/model.ts';
import { validateLocation } from './model.ts';
import type { LocalTransform } from '../items/model.ts';
import { disposeEntity } from './rendering.ts';

/** A presentation-only cursor; custody changes only after a valid click. */
export class AssetPlacement {
    private ray = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private hovered = false;
    private rotation = 0;
    private candidate: LocalTransform | null = null;
    private abort = new AbortController();
    private panel = document.createElement('div');
    private bounds: THREE.BoxHelper;
    constructor(private o: {canvas:HTMLCanvasElement;camera:THREE.Camera;scene:THREE.Scene;surfaces():THREE.Object3D[];height(x:number,z:number):number;token:number;valid():boolean;preview:THREE.Group;place(t:LocalTransform):void;cancel():void}) {
        o.scene.add(o.preview);o.preview.visible=false;
        this.bounds=new THREE.BoxHelper(o.preview,0xcceca0);o.scene.add(this.bounds);this.bounds.visible=false;
        this.panel.className='asset-placement';
        this.panel.innerHTML='<strong>Choose a spot</strong><p>Move over terrain or a foundation · Click to place<br>R rotate · Esc cancel</p><button type="button">Cancel placement</button>';
        document.getElementById('app')!.append(this.panel);
        const signal=this.abort.signal;
        this.panel.querySelector('button')!.addEventListener('click',o.cancel,{signal});
        o.canvas.addEventListener('pointermove',e=>{const r=o.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.hovered=true;},{signal});
        o.canvas.addEventListener('pointerleave',()=>{this.hovered=false;},{signal});
        o.canvas.addEventListener('click',e=>{if(e.button!==0)return;this.update();if(this.candidate)o.place({...this.candidate});},{signal});
        window.addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='Escape'){e.preventDefault();o.cancel();}if(e.code==='KeyR'){e.preventDefault();this.rotation=(this.rotation+1500)%36000;}},{signal});
    }
    update(){
        this.candidate=null;this.o.preview.visible=false;this.bounds.visible=false;
        if(!this.o.valid()){this.o.cancel();return;}if(!this.hovered)return;
        this.o.camera.updateMatrixWorld();this.o.scene.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.o.camera);
        const hit=this.ray.intersectObjects(this.o.surfaces(),true)[0];if(!hit)return;
        const t={...worldToObjectPosition(this.o.token,hit.point.x,hit.point.z),rotation:this.rotation};
        // Use encoded coordinates for both preview and persistence to avoid rounding offsets.
        const {x,z}=objectToWorldPosition(this.o.token,t);
        this.o.preview.position.set(x,this.o.height(x,z),z);this.o.preview.rotation.y=this.rotation/100*Math.PI/180;this.o.preview.visible=true;
        let valid=true;try{validateLocation({kind:'parcel',parcelId:this.o.token,...t});}catch{valid=false;}
        this.bounds.setFromObject(this.o.preview);this.bounds.visible=true;(this.bounds.material as THREE.LineBasicMaterial).color.set(valid?0xcceca0:0xff7766);
        if(valid)this.candidate=t;
        this.panel.querySelector('strong')!.textContent=valid?'Click to place':'Keep the object inside your parcel';
    }
    dispose(){this.abort.abort();this.panel.remove();disposeEntity(this.o.preview);this.bounds.removeFromParent();this.bounds.geometry.dispose();(this.bounds.material as THREE.Material).dispose();}
}
