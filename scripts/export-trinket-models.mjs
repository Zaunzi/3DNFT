// Extract only trusted, repository-owned geometry. No instrument UI, audio or loops execute.
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeKeys} from '../keyboard/notes.js';
import {xyloNotes} from '../instruments/notes.js';
class Reader {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}}
globalThis.FileReader=Reader;
const section=(file,start,end)=>{const s=fs.readFileSync(file,'utf8'),a=s.indexOf(start),b=s.indexOf(end,a);if(a<0||b<0)throw Error('Geometry source changed: '+file);return s.slice(a,b);};
const sources=[
 section('dj-board/main.js','const board=new THREE.Group();','const floor=').replace(/function label\([^\n]+\n/,'function label(){}\n'),
 section('keyboard/main.js','const board=new THREE.Group();','let yaw=').replace(/function label\([^\n]+\n/,'function label(){}\n'),
 section('drumkit/main.js','const kit=new THREE.Group();','const textureCanvas='),
 section('instruments/percussion.js','const root=new THREE.Group();','let yaw='),
];
fs.mkdirSync('app/src/trinkets/models',{recursive:true});
for(let id=1;id<=5;id++){
 const scene=new THREE.Scene();vm.runInNewContext(sources[Math.min(id-1,3)],{THREE,scene,keys:makeKeys(),meshes:new Map(),visuals:new Map(),xylo:id===4,xyloNotes},{timeout:10000});
 const model=scene.children[0];const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
 // All rotations fit the escrow's 2m radius. Center on X/Z, base at Y=0.
 const scale=3.2/Math.hypot(size.x,size.z);const center=bounds.getCenter(new THREE.Vector3());model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 model.traverse(o=>{o.userData={};});
 const result=await new GLTFExporter().parseAsync(model,{binary:true});fs.writeFileSync(`app/src/trinkets/models/${id}.glb`,Buffer.from(result));console.log(id,result.byteLength);
}
