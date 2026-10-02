"""Plan a deterministic collection using the actual expanded catalog, without changing donors."""
import json,random,hashlib,collections,sys
from pathlib import Path
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=False)
SUPPLY=int(sys.argv[3]) if len(sys.argv)>3 else 1000
assert 1<=SUPPLY<=5000
catalog=json.loads((src/'trait-catalog.json').read_text());rng=random.Random(1000302026)
def pick(slot,allowed=None):
    rows=[r for r in catalog[slot] if allowed is None or r['name'] in allowed]
    return rng.choices(rows,weights=[r['weight'] for r in rows])[0]
def number(t):return int(t['source'].split('-')[0]) if t['source'] else 0
recipes=[];seen=set()
while len(recipes)<SUPPLY:
    t={k:pick(k) for k in catalog}
    # Keep substantial room for hairstyles as well as hats.
    t['headwear']=pick('headwear',{'None'}) if rng.random()<.48 else pick('headwear',{r['name'] for r in catalog['headwear'] if r['source']})
    if t['headwear']['name'] not in ['None','Headphones']:t['hair']=pick('hair',{'Bald'})
    elif t['headwear']['name']=='Headphones':t['hair']=pick('hair',{'Bald','Crop','Side part','Curly','Buzz'})
    # New hat/eyewear pairings have not had exhaustive clearance review.
    if t['headwear']['name']!='None':
        t['eyewear']=pick('eyewear',{'None'});t['earwear']=pick('earwear',{'None'})
    allowed_chain={'Tee','Cream shirt','Workshirt','Overalls'}
    if t['neckwear']['name']=='Chain' and t['outfit']['name'] not in allowed_chain:t['neckwear']=pick('neckwear',{'None'})
    if t['neckwear']['name']=='Bow tie' and t['outfit']['name']!='Cream shirt':t['neckwear']=pick('neckwear',{'None'})
    if t['facial_hair']['name'] in ['Long beard','Forked beard']:t['neckwear']=pick('neckwear',{'None'})
    if t['outfit']['name'] not in {'Tee','Cream shirt','Workshirt','Overalls','Tracksuit','Denim vest'}:t['backwear']=pick('backwear',{'None'})
    if number(t['outfit'])>=40:t['neckwear']=pick('neckwear',{'None'});t['backwear']=pick('backwear',{'None'})
    if t['hair']['name'] in ['Mullet','Ponytail','Locs','Man bun','Braided rows']:t['backwear']=pick('backwear',{'None'})
    # Earrings are kept clear of new hair geometry.
    if number(t['hair'])>=40:t['earwear']=pick('earwear',{'None'})
    sig=tuple((k,t[k]['name']) for k in sorted(t) if k!='background')
    if sig in seen:continue
    seen.add(sig);n=len(recipes)+1
    recipes.append({'token_id':n,'name':f'CryptoDoodz #{n:04}','traits':{k:v['name'] for k,v in t.items()},'sources':{k:v['source'] for k,v in t.items()},'appearance_signature':hashlib.sha256(json.dumps(sig).encode()).hexdigest()})
counts={k:dict(collections.Counter(r['traits'][k] for r in recipes)) for k in catalog}
missing={(k,o['name']) for k,rows in catalog.items() for o in rows if o['name'] not in counts[k]}
assert not missing,missing
for r in recipes:
    assert 'puffer' not in json.dumps(r).lower()
    for slot,donor in r['sources'].items():
        if donor and not donor.startswith('#'):assert (src/'traits'/f'{donor}-{slot}.glb').exists(),(slot,donor)
targets={(k,o['name']) for k,rows in catalog.items() for o in rows if o['source'] and not o['source'].startswith('#')}
sample=[]
while targets:
    best=max(recipes,key=lambda r:sum(r['traits'][k]==v for k,v in targets));sample.append(best)
    targets={p for p in targets if best['traits'][p[0]]!=p[1]}
for name,data in [('recipes.json',recipes),('sample-recipes.json',sample),('trait-catalog.json',catalog),('distribution.json',{'supply':SUPPLY,'seed':1000302026,'unique_appearances_excluding_background':SUPPLY,'counts':counts,'coverage_sample':len(sample),'status':'generated recipes; validation pending'})]:
    (out/name).write_text(json.dumps(data,indent=2))
print(SUPPLY,'unique recipes;',sum(map(len,catalog.values())),'catalog options;',len(sample),'coverage models; every trait represented.')
