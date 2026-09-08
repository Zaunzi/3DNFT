"""Release-level completeness and exclusion audit, independent of recipe generation."""
import json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
recipes=json.loads((root/'recipes.json').read_text()); sample=json.loads((root/'sample-recipes.json').read_text()); catalog=json.loads((root/'trait-catalog.json').read_text())
assert len(recipes)==1000 and {r['token_id'] for r in recipes}==set(range(1,1001))
signatures=[tuple(sorted((k,v) for k,v in r['traits'].items() if k!='background')) for r in recipes]
assert len(set(signatures))==1000
assert not any('puffer' in p.name.lower() for p in root.rglob('*') if p.is_file())
for r in recipes:
    assert 'puffer' not in json.dumps(r).lower()
    for key,value in r['sources'].items():
        if value and not value.startswith('#'): assert (root/'source'/f'{value}.blend').is_file(),value
    t=r['traits']
    assert t['headwear'] in ['None','Headphones'] or t['hair']=='Bald'
    assert t['facial_hair']!='Long beard' or t['neckwear']=='None'
    assert t['neckwear']!='Bow tie' or t['outfit']=='Cream shirt'
for r in sample:
    ident=f"{r['token_id']:04}"
    assert (root/'sample/models'/f'{ident}.glb').is_file(),ident
    assert (root/'sample/renders'/f'{ident}.png').is_file(),ident
new_sources={o['source'] for options in catalog.values() for o in options if o['source'] and o['source'][:2].isdigit() and int(o['source'][:2])>=20}
shown={v for r in sample for v in r['sources'].values()}
assert new_sources<=shown,new_sources-shown
report={'status':'pass','recipes':1000,'unique_appearances_ignoring_background':1000,'removed_trait_in_active_assets':False,'sample_models_and_renders':len(sample),'new_mesh_traits_covered':len(new_sources),'all_source_files_exist':True}
(root/'collection-audit.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report))
