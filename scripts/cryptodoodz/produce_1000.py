"""Lossless mesh/skin composition from validated GLB traits. No geometry generation."""
import json,struct,sys,copy,hashlib
from pathlib import Path
SOURCE=Path(sys.argv[1]).resolve(); OUT=Path(sys.argv[2]).resolve()
(OUT/'models').mkdir(parents=True,exist_ok=True); (OUT/'metadata').mkdir(exist_ok=True)
cache={}
def read(path):
    if path not in cache:
        raw=path.read_bytes(); n=struct.unpack_from('<I',raw,12)[0]
        cache[path]=(json.loads(raw[20:20+n]),raw[28+n:])
    return cache[path]
def color(hexvalue):
    def linear(x): return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
    return [linear(int(hexvalue[i:i+2],16)/255) for i in [1,3,5]]+[1]
def accessor_bytes(d,b,index):
    a=d['accessors'][index]; v=d['bufferViews'][a['bufferView']]
    return b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
recipes=json.loads((SOURCE/'recipes.json').read_text()); assert len(recipes)==1000
base,basebin=read(SOURCE/'models/reusable-body.glb')
joint_names=[base['nodes'][i]['name'] for i in base['skins'][0]['joints']]
basebind=accessor_bytes(base,basebin,base['skins'][0]['inverseBindMatrices'])
receipt=[]
for recipe in recipes:
    d=copy.deepcopy(base); binary=bytearray(basebin)
    root=next(i for i,n in enumerate(d['nodes']) if n.get('name')=='CryptoDoodz_Rig')
    src=recipe['sources']
    for mat in d['materials']:
        if mat.get('name','').split('.')[0]=='skin': mat['pbrMetallicRoughness']['baseColorFactor']=color(src['skin'])
    components=[('brows','01-base'),('trousers','35-tracksuit' if src['outfit']=='35-tracksuit' else '01-base'),('shoes','01-base')]+[(slot,src.get(slot)) for slot in ['hair','headwear','facial_hair','eyewear','outfit','neckwear','earwear','backwear']]
    for slot,donor in components:
        if donor is None: continue
        sd,sb=read(SOURCE/'traits'/f'{donor}-{slot}.glb')
        assert [sd['nodes'][i]['name'] for i in sd['skins'][0]['joints']]==joint_names
        assert accessor_bytes(sd,sb,sd['skins'][0]['inverseBindMatrices'])==basebind
        sroot=next(i for i,n in enumerate(sd['nodes']) if n.get('name')=='CryptoDoodz_Rig')
        assert {k:v for k,v in sd['nodes'][sroot].items() if k not in ['children','name']}=={k:v for k,v in d['nodes'][root].items() if k not in ['children','name']}
        views={}; accessors={}; materials={}
        def access(index):
            if index in accessors:return accessors[index]
            a=copy.deepcopy(sd['accessors'][index]); vi=a['bufferView']
            if vi not in views:
                view=copy.deepcopy(sd['bufferViews'][vi]); start=view.get('byteOffset',0)
                while len(binary)%4: binary.append(0)
                view['byteOffset']=len(binary); view['buffer']=0
                binary.extend(sb[start:start+view['byteLength']]); views[vi]=len(d['bufferViews']); d['bufferViews'].append(view)
            a['bufferView']=views[vi]; accessors[index]=len(d['accessors']); d['accessors'].append(a)
            return accessors[index]
        for ni,node in enumerate(sd['nodes']):
            if 'mesh' not in node: continue
            assert ni in sd['nodes'][sroot]['children'] and node.get('skin')==0 and 'children' not in node
            mesh=copy.deepcopy(sd['meshes'][node['mesh']])
            for primitive in mesh['primitives']:
                primitive['attributes']={k:access(v) for k,v in primitive['attributes'].items()}
                primitive['indices']=access(primitive['indices'])
                tint=None; name=node.get('name','')
                if slot in ['hair','brows','facial_hair']:tint=src['hair_color']
                elif slot=='trousers' and not name.startswith('tracksuit_'):tint=src['trousers_color']
                elif slot=='shoes' and not name.startswith('shoe_sole'):tint=src['shoes_color']
                key=(primitive['material'],tint)
                if key not in materials:
                    mat=copy.deepcopy(sd['materials'][primitive['material']])
                    if tint:mat['pbrMetallicRoughness']['baseColorFactor']=color(tint)
                    materials[key]=len(d['materials']);d['materials'].append(mat)
                primitive['material']=materials[key]
            nn=copy.deepcopy(node); nn['mesh']=len(d['meshes']); d['meshes'].append(mesh); nn['skin']=0
            d['nodes'][root]['children'].append(len(d['nodes']));d['nodes'].append(nn)
    d['asset']['generator']='CryptoDoodz validated GLB composer 1.0'
    d['asset']['extras']={'token_id':recipe['token_id'],'appearance_signature':recipe['appearance_signature'],'traits':recipe['traits']}
    d['buffers']=[{'byteLength':len(binary)}]
    j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
    output=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
    ident=f"{recipe['token_id']:04}"; path=OUT/'models'/f'{ident}.glb';path.write_bytes(output)
    metadata={'name':recipe['name'],'description':'CryptoDoodz — an original animated male voxel character.','attributes':[{'trait_type':k.replace('_',' ').title(),'value':v} for k,v in recipe['traits'].items()]}
    (OUT/'metadata'/f'{ident}.json').write_text(json.dumps(metadata,indent=2))
    receipt.append({'token_id':recipe['token_id'],'file':f'models/{ident}.glb','bytes':len(output),'sha256':hashlib.sha256(output).hexdigest(),'appearance_signature':recipe['appearance_signature']})
    if recipe['token_id']%100==0:print('EXPORTED',recipe['token_id'],flush=True)
assert len({r['sha256'] for r in receipt})==1000
(OUT/'production-manifest.json').write_text(json.dumps({'count':1000,'source':'approved v1 revision 2','files':receipt},indent=2))
for name in ['recipes.json','trait-catalog.json','distribution.json']:(OUT/name).write_bytes((SOURCE/name).read_bytes())
print('PRODUCTION_COMPLETE')
