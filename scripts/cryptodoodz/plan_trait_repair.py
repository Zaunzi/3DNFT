"""Select existing recipes affected by a donor repair; never reroll identities."""
import json, sys
from pathlib import Path

library, original, destination = map(Path, sys.argv[1:4])
destination.mkdir(parents=True, exist_ok=False)
changes = json.loads((library/'repair-r11.json').read_text())
recipes = json.loads((original/'recipes.json').read_text())
affected = [recipe for recipe in recipes if any(
    recipe['sources'].get(change['slot']) == change['source'] for change in changes)]
(destination/'recipes.json').write_text(json.dumps(affected, indent=2), encoding='utf-8')
for name in ['trait-catalog.json', 'distribution.json']:
    (destination/name).write_bytes((original/name).read_bytes())
print(f'{len(affected)} affected recipes; token IDs and all trait choices preserved.')
