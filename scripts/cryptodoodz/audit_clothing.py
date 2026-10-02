"""Verify requested clothing fixes in all composed collection GLBs."""
import json,struct,sys
from pathlib import Path
root=Path(sys.argv[1]);recipes=json.loads((root/'recipes.json').read_text());counts={'models':0,'tracksuits':0,'suits':0}
for recipe in recipes:
    raw=(root/'models'/f"{recipe['token_id']:04}.glb").read_bytes();n=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+n])
    def colors(node):return [d['materials'][p['material']]['pbrMetallicRoughness']['baseColorFactor'] for p in d['meshes'][node['mesh']]['primitives']]
    pelvis=next(node for node in d['nodes'] if node.get('name','').startswith('body_pelvis'))
    thigh=next(node for node in d['nodes'] if node.get('name','').startswith('trousers_thigh'))
    assert colors(pelvis)[0]==colors(thigh)[0],recipe['token_id']
    outfit=recipe['sources']['outfit'];names=[node.get('name','') for node in d['nodes']]
    if outfit=='35-tracksuit':
        stripes=[node for node in d['nodes'] if node.get('name','').startswith('tracksuit_') and 'stripe' in node.get('name','')]
        assert len(stripes)==16
        for node in stripes:
            assert 'side_stripe' in node['name']
            position=d['accessors'][d['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']]
            x,y,z=[(a+b)/2 for a,b in zip(position['min'],position['max'])];assert abs(x)>.25 and abs(z)<.06,node
        counts['tracksuits']+=1
    if outfit=='36-suit-tie':
        assert 'suit_tie' in names and 'suit_shirt' in names
        assert not any('placket' in name or name.startswith('36-suit-tie_lapel') for name in names)
        counts['suits']+=1
    counts['models']+=1
(root/'clothing-audit.json').write_text(json.dumps(counts,indent=2));print('PASS',counts)
