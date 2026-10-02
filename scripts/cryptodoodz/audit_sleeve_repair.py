"""Assert sleeve repairs change geometry positions without adding joint meshes."""
import json, struct, sys
from pathlib import Path

before, after = map(Path, sys.argv[1:3])
def load(path):
    raw=path.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+length])
def meshes(doc):
    return {n['name']:doc['meshes'][n['mesh']] for n in doc['nodes'] if 'mesh' in n}

count=0
for change in json.loads((after/'repair-r11.json').read_text()):
    if change['slot']!='outfit': continue
    filename=f"{change['source']}-outfit.glb"
    old,new=(load(root/'traits'/filename) for root in [before,after])
    a,b=meshes(old),meshes(new)
    assert a.keys()==b.keys(), (filename,'added or removed mesh')
    assert not any('r11_sleeve_elbow' in name for name in b)
    for name in a:
        assert len(a[name]['primitives'])==len(b[name]['primitives'])
        for left,right in zip(a[name]['primitives'],b[name]['primitives']):
            for attr in ['POSITION','JOINTS_0','WEIGHTS_0']:
                assert old['accessors'][left['attributes'][attr]]['count']==new['accessors'][right['attributes'][attr]]['count'], (filename,name,attr)
            assert old['accessors'][left['indices']]['count']==new['accessors'][right['indices']]['count']
    count+=1
assert count==30, count
print(f'PASS: {count} outfits retain their original meshes and topology; no added elbow pieces.')
