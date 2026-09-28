import * as THREE from 'three';
/** Owns its meshes/materials; NFTLayer disposes the full entity on unload. */
export function createChest() {
  const g=new THREE.Group();
  const part=(geo:THREE.BufferGeometry,color:number,x:number,y:number,z:number,metal=false)=>{const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:metal?.36:.88,metalness:metal?.72:0}));mesh.position.set(x,y,z);g.add(mesh);return mesh;};
  // Board gaps, curved lid, straps, rivets and latch are geometry, not painted labels.
  for(let i=0;i<6;i++){const x=-.83+i*.332;part(new THREE.BoxGeometry(.32,.84,1.14),i%2?0x755038:0x896043,x,.55,0);}
  part(new THREE.BoxGeometry(2,.13,1.2),0x493626,0,.12,0);
  for(const x of [-.7,.7]){
    part(new THREE.BoxGeometry(.11,.92,1.19),0x554e3e,x,.58,0,true);
    const strap=part(new THREE.TorusGeometry(.6,.055,6,18,Math.PI),0x7e7556,x,1,0,true);strap.rotation.y=Math.PI/2;
    for(const z of [-.606,.606])for(const y of [.24,.78])part(new THREE.SphereGeometry(.034,8,6),0xd0b675,x,y,z,true);
  }
  const lid=part(new THREE.CylinderGeometry(.57,.57,1.98,16,1,false,0,Math.PI),0x9a7146,0,1,0);lid.rotation.z=Math.PI/2;
  part(new THREE.BoxGeometry(.22,.32,.09),0xc6a15c,0,.94,.64,true);
  part(new THREE.BoxGeometry(.045,.10,.015),0x29261f,0,.93,.695);
  for(const x of [-1.03,1.03]){const handle=part(new THREE.TorusGeometry(.14,.027,6,12,Math.PI*1.5),0x9e884f,x,.61,0,true);handle.rotation.y=Math.PI/2;}
  g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}

