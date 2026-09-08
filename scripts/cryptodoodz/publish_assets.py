"""Create exact-geometry polygon previews and static hosted metadata for the 1000 GLBs."""
import json,struct,shutil,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
SRC=Path('outputs/cryptodoodz-1000');DEST=Path('static/cryptodoodz')
for folder in ['models','images','metadata']: (DEST/folder).mkdir(parents=True,exist_ok=True)
recipes=json.loads((SRC/'recipes.json').read_text())
right=np.array([.894,0,-.447]);up=np.array([-.11,.97,-.22]);forward=np.cross(right,up);light=np.array([-.5,.8,1.0]);light/=np.linalg.norm(light)
def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
 m=np.eye(4);m[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
for recipe in recipes:
 ident=f"{recipe['token_id']:04}";source=SRC/'models'/f'{ident}.glb';shutil.copy2(source,DEST/'models'/source.name)
 raw=source.read_bytes();size=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+size]);b=raw[28+size:]
 def accessor(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];dtype={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]
  return np.ndarray((a['count'],count),dtype=dtype,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dtype).itemsize*count),np.dtype(dtype).itemsize))
 worlds={}
 def walk(i,p):
  worlds[i]=p@matrix(d['nodes'][i])
  for j in d['nodes'][i].get('children',[]):walk(j,worlds[i])
 for i in d['scenes'][0]['nodes']:walk(i,np.eye(4))
 faces=[]
 for i,n in enumerate(d['nodes']):
  if 'mesh' not in n:continue
  for p in d['meshes'][n['mesh']]['primitives']:
   positions=accessor(p['attributes']['POSITION']);world=(worlds[i]@np.c_[positions,np.ones(len(positions))].T).T[:,:3]
   rgb=d['materials'][p['material']]['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1])[:3]
   for ids in accessor(p['indices']).reshape(-1,3):
    pts=world[ids];normal=np.cross(pts[1]-pts[0],pts[2]-pts[0]);length=np.linalg.norm(normal)
    if length<1e-10:continue
    normal/=length
    if normal@forward<=0:continue
    shade=.65+.35*max(0,float(normal@light));c=tuple(round(255*min(1,(v*shade)**(1/2.2))) for v in rgb)
    xy=[(256+float(q@right)*195,475-float(q@up)*195) for q in pts];faces.append((pts@forward,xy,c))
 image=Image.new('RGB',(512,512),recipe['sources']['background']);pixels=np.array(image);depths=np.full((512,512),-np.inf)
 for depth,xy,c in faces:
  (x0,y0),(x1,y1),(x2,y2)=xy
  xmin=max(0,int(math.floor(min(x0,x1,x2))));xmax=min(511,int(math.ceil(max(x0,x1,x2))))
  ymin=max(0,int(math.floor(min(y0,y1,y2))));ymax=min(511,int(math.ceil(max(y0,y1,y2))))
  if xmin>xmax or ymin>ymax:continue
  denominator=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
  if abs(denominator)<1e-9:continue
  yy,xx=np.mgrid[ymin:ymax+1,xmin:xmax+1];xx=xx+.5;yy=yy+.5
  u=((y1-y2)*(xx-x2)+(x2-x1)*(yy-y2))/denominator;v=((y2-y0)*(xx-x2)+(x0-x2)*(yy-y2))/denominator;w=1-u-v
  z=u*depth[0]+v*depth[1]+w*depth[2];area=depths[ymin:ymax+1,xmin:xmax+1];mask=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)&(z>area)
  area[mask]=z[mask];pixels[ymin:ymax+1,xmin:xmax+1][mask]=c
 image=Image.fromarray(pixels)
 image.save(DEST/'images'/f'{ident}.png')
 meta=json.loads((SRC/'metadata'/f'{ident}.json').read_text());base='https://3dnft.vercel.app/cryptodoodz'
 meta.update(image=f'{base}/images/{ident}.png',animation_url=f'{base}/models/{ident}.glb',external_url=f'{base}/?id={recipe["token_id"]}')
 (DEST/'metadata'/f'{ident}.json').write_text(json.dumps(meta,separators=(',',':')))
 if recipe['token_id']%100==0:print('PREVIEWS',recipe['token_id'],flush=True)
