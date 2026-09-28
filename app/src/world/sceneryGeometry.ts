import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Decorative shapes only: canonical vegetation locations and terrain stay unchanged. */
export function pineGeometry() {
  const layers: THREE.BufferGeometry[] = [];
  for (let tier=0;tier<5;tier++) {
    const radius=1.8-tier*.28, height=2.8-tier*.22;
    const geometry=new THREE.ConeGeometry(radius,height,12,3);
    const p=geometry.getAttribute('position');
    for(let i=0;i<p.count;i++) {const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const a=Math.atan2(z,x);const scallop=1+.09*Math.sin(a*6+tier*.8)*(1-(y+height/2)/height);p.setXYZ(i,x*scallop,y,z*scallop);}
    geometry.rotateY(tier*.67);geometry.translate(0,2.4+tier*.72,0);geometry.computeVertexNormals();
    const colors=[];for(let i=0;i<p.count;i++){const c=new THREE.Color().setHSL(.29+tier*.007,.28,.165+tier*.020+(p.getY(i)%1)*.018);colors.push(c.r,c.g,c.b);}geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));layers.push(geometry);
  }
  const result=mergeGeometries(layers)!;layers.forEach(g=>g.dispose());return result;
}
export function rockGeometry(radius:number) {
  const g=new THREE.IcosahedronGeometry(radius,2),p=g.getAttribute('position'),colors:number[]=[];
  for(let i=0;i<p.count;i++) {const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=1+.11*Math.sin(x*7+z*3)*Math.cos(y*5-z*4);p.setXYZ(i,x*n*1.1,y*n*.72,z*n*.88);const c=new THREE.Color().setHSL(y>radius*.35?.23:.12,y>radius*.35?.16:.06,.32+.075*(y/radius)+.025*Math.sin(x*13+z*9));colors.push(c.r,c.g,c.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

