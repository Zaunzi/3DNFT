import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {getAddress} from 'viem';
import type {NFTAsset} from './model.ts';
export function characterAsset(chainId:number,collection:string,id:string):NFTAsset {
  if(!/^[0-9]+$/.test(id)||BigInt(id)<1n||BigInt(id)>1000n)throw new Error('Character ID must be between 1 and 1000.');
  return {chainId,contractAddress:getAddress(collection),tokenId:BigInt(id)};
}
export function characterModelURL(id:bigint){if(id<1n||id>1000n)throw new Error('Invalid character ID');return `https://3dnft.vercel.app/cryptodoodz/models/${String(id).padStart(4,'0')}.glb`;}
const MAX_BYTES=8*1024*1024;
export function validateCharacterGLB(bytes:ArrayBuffer){
  const view=new DataView(bytes);
  if(bytes.byteLength<20||bytes.byteLength>MAX_BYTES||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw new Error('Invalid character model');
  const length=view.getUint32(12,true);if(length>bytes.byteLength-20)throw new Error('Invalid model JSON');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  if([...json.buffers??[],...json.images??[]].some(v=>v.uri))throw new Error('Character models must be self-contained');
}
/** Cache bounded source bytes, not shared GPU objects: every streamed entity owns its resources. */
export class CharacterModels {
  private cache=new Map<bigint,Promise<ArrayBuffer>>();
  async load(id:bigint){
    let pending=this.cache.get(id);
    if(!pending){pending=this.fetch(id);this.cache.set(id,pending);if(this.cache.size>16)this.cache.delete(this.cache.keys().next().value!);}
    let bytes:ArrayBuffer;try{bytes=await pending;}catch(error){if(this.cache.get(id)===pending)this.cache.delete(id);throw error;}
    const gltf=await new GLTFLoader().parseAsync(bytes,'');
    const model=gltf.scene, bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=Math.min(2.2/Math.max(size.y,.001),2.6/Math.max(size.x,size.z,.001));
    model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    const group=new THREE.Group();group.add(model);group.userData.characterModel=true;return group;
  }
  private async fetch(id:bigint){
    const response=await fetch(characterModelURL(id),{signal:AbortSignal.timeout(20000),credentials:'omit',redirect:'error'});
    if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES||!response.body)throw new Error('Character model unavailable');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
    try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_BYTES)throw new Error('Character model too large');chunks.push(part.value);}}finally{await reader.cancel();}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    validateCharacterGLB(bytes.buffer);return bytes.buffer;
  }
  clear(){this.cache.clear();}
}
