import * as T from 'three';
export function dressDowntown(scene:T.Scene,sign:(text:string,x:number,y:number,z:number,w:number)=>T.Mesh){
 const batches=new Map<number,T.Matrix4[]>(),matrix=new T.Matrix4(),p=new T.Vector3(),s=new T.Vector3(),q=new T.Quaternion();
 function box(c:number,x:number,y:number,z:number,w:number,h:number,d:number){matrix.compose(p.set(x,y,z),q,s.set(w,h,d));if(!batches.has(c))batches.set(c,[]);batches.get(c)!.push(matrix.clone());}
 for(const side of [-1,1]){
  // Flush paving connects the courtyards and shop fronts without covering interior floors.
  box(0xb7b7a5,108,.065,side*36,10,.02,50);box(0xb7b7a5,108,.065,side*37,54,.02,8);
  for(const x of [83,108,133])box(0xcbd0bb,x,.065,side*12,3,.02,5);
  for(const x of [105,111])for(let z=14;z<60;z+=3)box(0x999f91,x,.079,side*z,.05,.012,2.8);
  for(const x of [85,131]){
   box(0x384c51,x,2.7,side*35,.14,5.4,.14);box(0xffddb2,x,5.4,side*35,1.8,.2,.7);
   // Recessed flower beds and seating stay away from walking routes.
   box(0x9c9e87,x,.35,side*33,2.4,.65,2.4);box(0x738b63,x,.95,side*33,2.1,.7,2.1);
   for(let i=0;i<3;i++)box(0x946f50,x,.65,side*41+(i-1)*.18,2.5,.12,.14);
   for(const dx of [-.9,.9])box(0x3c5257,x+dx,.32,side*41,.12,.6,.65);
  }
  for(const x of [94,122]){box(0x314e58,x,3.6,side*11,.1,3,.1);box(0xa36c53,x+.65,4.3,side*11,1.2,1.8,.05);}
 }
 for(const side of [-1,1]){box(0x334c53,108,1.3,side*9,11,2.6,.6);const title=sign('DOWNTOWN',108,1.5,side*8.65,10);title.scale.y=.65;title.rotation.y=side<0?0:Math.PI;}
 const geometry=new T.BoxGeometry(),meshes:T.InstancedMesh[]=[];
 for(const [color,list]of batches){const material=new T.MeshStandardMaterial({color,roughness:.88});const mesh=new T.InstancedMesh(geometry,material,list.length);list.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}
 return {dispose(){for(const mesh of meshes){scene.remove(mesh);(mesh.material as T.Material).dispose();}geometry.dispose();}};
}
