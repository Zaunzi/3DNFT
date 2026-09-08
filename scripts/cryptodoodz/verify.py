"""Independent GLB structural/animation checks; writes an evidence report."""
import json, struct, math, hashlib, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]/'outputs/cryptodoodz-v1'
if (Path(__file__).resolve().parent.parent/'models').exists(): ROOT=Path(__file__).resolve().parent.parent
if len(sys.argv)>1: ROOT=Path(sys.argv[1]).resolve()
report=[]
def check(path):
    raw=path.read_bytes(); magic,version,size=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and size==len(raw)
    n,typ=struct.unpack_from('<II',raw,12); assert typ==0x4e4f534a
    doc=json.loads(raw[20:20+n]); offset=20+n
    binary_size,binary_type=struct.unpack_from('<II',raw,offset); assert binary_type==0x004e4942
    binary=raw[offset+8:offset+8+binary_size]
    def values(i):
        a=doc['accessors'][i]; view=doc['bufferViews'][a['bufferView']]
        fmt,sz={5126:('f',4),5125:('I',4),5123:('H',2),5121:('B',1)}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        start=view.get('byteOffset',0)+a.get('byteOffset',0); stride=view.get('byteStride',sz*width)
        assert start+(a['count']-1)*stride+sz*width<=len(binary)
        result=[struct.unpack_from('<'+fmt*width,binary,start+k*stride) for k in range(a['count'])]
        assert all(math.isfinite(v) for row in result for v in row)
        return result
    for i in range(len(doc['accessors'])): values(i)
    skins=doc.get('skins',[]); assert len(skins)==1
    joints=skins[0]['joints']; assert len(joints)==16
    triangles=0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            attrs=primitive['attributes']; assert 'JOINTS_0' in attrs and 'WEIGHTS_0' in attrs,(path.name,mesh.get('name'),attrs)
            assert all(abs(sum(row)-1)<1e-5 for row in values(attrs['WEIGHTS_0']))
            assert all(0<=v<len(joints) for row in values(attrs['JOINTS_0']) for v in row)
            indices=values(primitive['indices']); assert max(row[0] for row in indices)<doc['accessors'][attrs['POSITION']]['count']
            triangles+=len(indices)//3
    clips={a['name']:a for a in doc.get('animations',[])}
    assert set(clips)=={'Idle','Walk','Run','Jump','Shoot','Wave'},(path.name,list(clips))
    durations={}
    for name,a in clips.items():
        changing=False
        for si,s in enumerate(a['samplers']):
            times=[r[0] for r in values(s['input'])]; assert all(b>a for a,b in zip(times,times[1:]))
            rows=values(s['output']); changing |= any(row!=rows[0] for row in rows)
            if name in ['Idle','Walk','Run']:
                is_rotation=all(c['target']['path']=='rotation' for c in a['channels'] if c['sampler']==si)
                same=all(abs(x-y)<1e-5 for x,y in zip(rows[0],rows[-1]))
                opposite=is_rotation and all(abs(x+y)<1e-5 for x,y in zip(rows[0],rows[-1]))
                assert same or opposite,(str(path),name,times[0],times[-1],rows[0],rows[-1])
            durations[name]=round(times[-1],3)
        assert changing,name+' has no movement'
    assert triangles<10000
    return {'file':str(path.relative_to(ROOT)),'bytes':len(raw),'triangles':triangles,'bones':len(joints),'clips_seconds':durations,'sha256':hashlib.sha256(raw).hexdigest(),'status':'pass'}
for path in sorted(ROOT.rglob('*.glb')): report.append(check(path))
(ROOT/'validation.json').write_text(json.dumps({'checks':'GLB headers, finite accessors, buffer bounds, skin weights, joint indices, triangle indices, six moving clips, loop endpoints, <10k triangles. Does not certify engine/game integration.','files':report},indent=2))
print(f'PASS: {len(report)} GLB files; skin, geometry, and all six animated clips validated.')
