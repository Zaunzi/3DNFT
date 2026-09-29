import * as THREE from 'three';
/** Individually owned meshes: disposed with the streamed door entity. */
export function createLockedDoor(){
 const root=new THREE.Group(),leaf=new THREE.Group();leaf.name='door-panel';leaf.position.x=-.92;root.add(leaf);
 const part=(parent:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,color:number,metal=false)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:metal?.35:.85,metalness:metal?.7:0}));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 for(const x of [-1.01,1.01])part(root,.18,2.9,.34,x,1.45,0,0x574530);
 part(root,2.2,.16,.34,0,2.91,0,0x574530);
 for(let i=0;i<6;i++)part(leaf,.30,2.78,.16,.16+i*.306,1.41,0,i%2?0x885b35:0x996a40);
 for(const y of [.42,2.35]){part(leaf,1.82,.12,.21,.92,y,0,0x403c34,true);for(const x of [.15,.65,1.2,1.65])for(const z of [-.12,.12]){const rivet=new THREE.Mesh(new THREE.SphereGeometry(.028,8,6),new THREE.MeshStandardMaterial({color:0xb59860,metalness:.75,roughness:.35}));rivet.position.set(x,y,z);leaf.add(rivet);}}
 for(const z of [-.13,.13]){part(leaf,.18,.34,.05,1.58,1.3,z,0xc19a50,true);part(leaf,.035,.085,.012,1.58,1.24,z*1.25,0x24231f);const handle=new THREE.Mesh(new THREE.TorusGeometry(.085,.018,6,12),new THREE.MeshStandardMaterial({color:0xc19a50,metalness:.75,roughness:.3}));handle.position.set(1.58,1.39,z*1.35);leaf.add(handle);}
 return root;
}
