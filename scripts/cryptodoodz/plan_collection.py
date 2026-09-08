"""Seeded 1,000-character recipe set. Does not claim unrendered tokens are finished."""
import random,json,collections,hashlib,sys
from pathlib import Path
ROOT=Path(sys.argv[1]).resolve(); rng=random.Random(10002026)
def options(rows): return [{'name':n,'source':s,'weight':w} for n,s,w in rows]
catalog={
 'skin':options([(n,c,1) for n,c in zip(['Sand','Umber','Bronze','Peach','Walnut','Honey'],['#CB946B','#65412F','#B98258','#D8A181','#946343','#D3A483'])]),
 'hair':options([('Bald',None,12),('Crop','01-base',25),('Side part','05-thinker',22),('Mohawk','04-punk',8),('Curly','14-curly',20),('Buzz','15-buzz',18)]),
 'hair_color':options([('Black','#231E1B',35),('Brown','#493026',30),('Ginger','#A44228',15),('Blond','#B69254',12),('Silver','#BFC3C1',8)]),
 'headwear':options([('None',None,45),('Beanie','02-skater',15),('Cap','03-mechanic',12),('Backward cap','09-backward-cap',12),('Bucket hat','10-bucket-hat',8),('Headphones','11-headphones',10),('Durag','16-durag',10)]),
 'facial_hair':options([('None',None,50),('Mustache','03-mechanic',18),('Beard','06-veteran',12),('Goatee','12-goatee',20)]),
 'eyewear':options([('None',None,55),('Glasses','05-thinker',25),('Sunglasses','08-shades',20)]),
 'outfit':options([('Tee','01-base',25),('Hoodie','02-skater',18),('Workshirt','03-mechanic',13),('Black jacket','04-punk',12),('Cream shirt','05-thinker',16),('Green jacket','06-veteran',10),('Varsity','13-varsity',12),('Overalls','17-overalls',12)]),
 'neckwear':options([('None',None,85),('Chain','19-chain',15)]),
 'trousers_color':options([('Charcoal','#26282D',60),('Indigo','#283C56',25),('Olive','#485040',15)]),
 'shoes_color':options([('Black','#24262C',60),('Cream','#D5CEBC',25),('Burgundy','#703747',15)]),
 'background':options([('Sky','#8EAAC0',1),('Coral','#D8A18E',1),('Sage','#91AC99',1),('Lilac','#B0A1C4',1),('Sand','#C8B183',1)])}
additions={
 'hair':[('Flat top','20-flat-top',12),('Locs','21-locs',12),('Ponytail','22-ponytail',12)],
 'facial_hair':[('Stubble','23-stubble',20),('Handlebar','24-handlebar',10),('Chinstrap','25-chinstrap',12),('Long beard','26-long-beard',9)],
 'headwear':[('Cowboy hat','27-cowboy',9),('Hard hat','28-hard-hat',10),('Sailor cap','29-sailor',9)],
 'eyewear':[('Round shades','30-round-shades',14),('Ski goggles','31-goggles',9),('Visor','32-visor',9),('Eyepatch','33-eyepatch',7)],
 'outfit':[('Denim vest','34-denim-vest',12),('Tracksuit','35-tracksuit',12),('Suit and tie','36-suit-tie',10)],
 'neckwear':[('Bow tie','38-bow-tie',12)],
 'earwear':[('None',None,75),('Earrings','37-earrings',25)],
 'backwear':[('None',None,75),('Backpack','39-backpack',25)]}
for k,rows in additions.items(): catalog.setdefault(k,[]).extend(options(rows))
def choose(key,allowed=None):
    vals=[x for x in catalog[key] if allowed is None or x['name'] in allowed]
    return rng.choices(vals,weights=[x['weight'] for x in vals])[0]
def valid(t):
    if t['headwear']['name'] not in ['None','Headphones'] and t['hair']['name']!='Bald': return False
    if t['headwear']['name']=='Headphones' and t['hair']['name'] not in ['Bald','Crop','Side part','Curly','Buzz']: return False
    if t['neckwear']['name']=='Chain' and t['outfit']['name'] not in ['Tee','Cream shirt','Workshirt','Overalls']: return False
    if t['neckwear']['name']=='Bow tie' and t['outfit']['name']!='Cream shirt': return False
    if t['facial_hair']['name']=='Long beard' and t['neckwear']['name']!='None': return False
    if t['headwear']['name']=='Headphones' and t['earwear']['name']!='None': return False
    if t['backwear']['name']=='Backpack' and t['outfit']['name'] not in ['Tee','Cream shirt','Workshirt','Overalls','Tracksuit','Denim vest']: return False
    return True
recipes=[]; seen=set()
while len(recipes)<1000:
    traits={k:choose(k) for k in catalog}
    if not valid(traits): continue
    # Background cannot make an otherwise identical character count as unique.
    sig=tuple(traits[k]['name'] for k in catalog if k!='background')
    if sig in seen: continue
    seen.add(sig)
    ident=len(recipes)+1
    recipes.append({'token_id':ident,'name':f'CryptoDoodz #{ident:04}','traits':{k:v['name'] for k,v in traits.items()},'sources':{k:v['source'] for k,v in traits.items()},'appearance_signature':hashlib.sha256(json.dumps(sig).encode()).hexdigest()})
counts={k:dict(collections.Counter(r['traits'][k] for r in recipes)) for k in catalog}
assert len(seen)==1000
assert all(set(counts[k])=={o['name'] for o in catalog[k]} for k in catalog)
# Sample greedily covers the newly created traits, then fills with reproducible variety.
targets={(k,n) for k,rows in additions.items() for n,s,w in rows if s is not None}
sample=[]
while targets:
    best=max((r for r in recipes if r not in sample),key=lambda r:sum(r['traits'][k]==v for k,v in targets))
    sample.append(best); targets={pair for pair in targets if best['traits'][pair[0]]!=pair[1]}
for r in recipes:
    if len(sample)>=16: break
    if r not in sample: sample.append(r)
(ROOT/'recipes.json').write_text(json.dumps(recipes,indent=2))
(ROOT/'sample-recipes.json').write_text(json.dumps(sample,indent=2))
(ROOT/'trait-catalog.json').write_text(json.dumps(catalog,indent=2))
(ROOT/'distribution.json').write_text(json.dumps({'supply':1000,'seed':10002026,'status':'planned recipes; sample review precedes full production','unique_character_signatures':1000,'options_including_none_and_colors':sum(map(len,catalog.values())),'counts':counts},indent=2))
print('Planned 1000 unique compatible recipes;',sum(map(len,catalog.values())),'options;',len(sample),'sample characters.')
