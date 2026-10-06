import {CanvasTexture,Sprite,SpriteMaterial,SRGBColorSpace,type Scene,type Vector3} from 'three';
/** Cosmetic messages, facing the viewer and depth-tested against the world. */
export class SpeechBubbles {
 private entries=new Map<string,{sprite:Sprite;expires:number}>();
 private scene:Scene;
 constructor(scene:Scene){this.scene=scene;}
 show(id:string,text:string){
  this.remove(id);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;
  const ctx=canvas.getContext('2d')!;ctx.font='28px Arial';
  const lines:string[]=[];let line='';
  for(const char of Array.from(text.slice(0,280))){if(ctx.measureText(line+char).width>680){lines.push(line);line='';}line+=char;}if(line)lines.push(line);
  const height=Math.max(90,lines.length*36+48);canvas.height=height+18;
  ctx.fillStyle='#eef4df';ctx.beginPath();ctx.roundRect(0,0,768,height,22);ctx.fill();
  ctx.beginPath();ctx.moveTo(368,height-1);ctx.lineTo(384,height+18);ctx.lineTo(400,height-1);ctx.fill();
  ctx.font='28px Arial';ctx.fillStyle='#19352c';ctx.textAlign='center';ctx.textBaseline='top';lines.forEach((s,i)=>ctx.fillText(s.trim(),384,24+i*36));
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  const sprite=new Sprite(new SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}));
  sprite.center.set(.5,0);sprite.scale.set(3.4,3.4*canvas.height/768,1);sprite.visible=false;sprite.raycast=()=>{};this.scene.add(sprite);
  this.entries.set(id,{sprite,expires:performance.now()+6000});
  if(this.entries.size>25)this.remove(this.entries.keys().next().value!);
 }
 update(position:(id:string)=>Vector3|undefined){const now=performance.now();for(const [id,e]of this.entries){if(now>=e.expires){this.remove(id);continue;}const p=position(id);e.sprite.visible=!!p;if(p)e.sprite.position.copy(p).setY(p.y+.65);e.sprite.material.opacity=Math.min(1,(e.expires-now)/750);}}
 private remove(id:string){const e=this.entries.get(id);if(!e)return;e.sprite.removeFromParent();e.sprite.material.map?.dispose();e.sprite.material.dispose();this.entries.delete(id);}
 clear(){for(const id of this.entries.keys())this.remove(id);}
}
