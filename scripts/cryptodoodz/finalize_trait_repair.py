"""Update release receipts only after selective model/preview regeneration passes."""
import hashlib, json, sys
from pathlib import Path

original, repair, public = map(Path, sys.argv[1:4])
recipes = json.loads((original/'recipes.json').read_text())
by_id = {r['token_id']:r for r in recipes}
changed = json.loads((repair/'recipes.json').read_text())
affected = {r['token_id'] for r in changed}
assert all(r == by_id[r['token_id']] for r in changed), 'Trait identity changed'
validation = json.loads((repair/'validation.json').read_text())['files']
assert len(validation) == len(affected)
assert all(r['status'] == 'pass' for r in validation)
old = json.loads((public/'model-manifest.json').read_text())
manifest = {}
for recipe in recipes:
    token = recipe['token_id']
    model = public/'models'/f'{token:04}.glb'
    digest = hashlib.sha256(model.read_bytes()).hexdigest()
    if token not in affected:
        assert digest == old[str(token)], f'Unrelated model changed: {token}'
    else:
        assert digest == hashlib.sha256((repair/'models'/model.name).read_bytes()).hexdigest()
    manifest[str(token)] = digest
assert len(set(manifest.values())) == len(recipes)
(public/'model-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
release = json.loads((public/'release.json').read_text())
release.update(source='project-authored CryptoDoodz r11 repaired traits', geometryRevision='r11',
               repairedModels=len(affected), validatedModels=len(recipes),
               maxTriangles=max(release['maxTriangles'],max(r['triangles'] for r in validation)),
               maxModelBytes=max(p.stat().st_size for p in (public/'models').glob('*.glb')))
(public/'release.json').write_text(json.dumps(release,indent=2),encoding='utf-8')
interactive=public/'interactive/release.json'
viewer=json.loads(interactive.read_text())
viewer['source']='r11'
interactive.write_text(json.dumps(viewer,indent=2),encoding='utf-8')
print(f'PASS: {len(affected)} repaired models; {len(recipes)-len(affected)} unchanged models; all identities preserved.')
