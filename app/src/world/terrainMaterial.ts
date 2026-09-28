import { MeshStandardMaterial } from 'three';
/** World-space surface detail, shared at parcel seams; never changes collision heights. */
export function terrainMaterial() {
  const material=new MeshStandardMaterial({color:0xe0e8dd,vertexColors:true,roughness:1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 atlasWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\natlasWorld=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader=`varying vec3 atlasWorld;
      float atlasHash(vec2 p){return fract(sin(dot(mod(p,289.0),vec2(127.1,311.7)))*43758.5453);}
      float atlasNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(atlasHash(i),atlasHash(i+vec2(1,0)),f.x),mix(atlasHash(i+vec2(0,1)),atlasHash(i+vec2(1,1)),f.x),f.y);}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float patches=atlasNoise(atlasWorld.xz*.23);
      float grain=atlasNoise(atlasWorld.xz*1.7);
      diffuseColor.rgb*=mix(vec3(.71,.81,.60),vec3(1.08,1.01,.86),smoothstep(.25,.8,patches))*(.97+grain*.06);
    `);
  };
  material.customProgramCacheKey=()=> 'atlas-terrain-detail-v1';return material;
}


