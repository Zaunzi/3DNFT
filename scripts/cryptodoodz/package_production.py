import json,zipfile,hashlib,shutil,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(sys.argv[1]).resolve(); manifest=json.loads((root/'production-manifest.json').read_text())
assert len(list((root/'models').glob('*.glb')))==1000
assert len(list((root/'metadata').glob('*.json')))==1000
assert len(json.loads((root/'validation.json').read_text())['files'])==1000
assert len(json.loads((root/'reimport-review.json').read_text()))==16
assert 'puffer' not in (root/'recipes.json').read_text().lower()
for item in manifest['files']:assert hashlib.sha256((root/item['file']).read_bytes()).hexdigest()==item['sha256']
ids=[r['token_id'] for r in json.loads((root/'reimport-review.json').read_text())]
board=Image.new('RGB',(1200,1640),'#EEEDE8');draw=ImageDraw.Draw(board)
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',30);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
draw.text((20,12),'CryptoDoodz / 1,000 models exported',font=font,fill='#22252B')
for i,n in enumerate(ids):
    im=Image.open(root/'review'/f'{n:04}.png').convert('RGB').resize((296,370));x=i%4*300;y=60+i//4*392
    board.paste(im,(x,y));draw.text((x+10,y+370),f'#{n:04}',font=small,fill='#22252B')
board.save(root/'review/production-lineup.jpg',quality=95)
(root/'scripts').mkdir(exist_ok=True)
for name in ['produce_1000.py','verify.py','review_production.py','package_production.py']:shutil.copy2(Path(__file__).with_name(name),root/'scripts'/name)
dest=root.parent/'CryptoDoodz-1000-models.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in root.rglob('*'):
        if p.is_file() and p.suffix!='.log':z.write(p,'CryptoDoodz-1000/'+str(p.relative_to(root)))
with zipfile.ZipFile(dest) as z:
    assert z.testzip() is None
    assert sum(n.endswith('.glb') for n in z.namelist())==1000
print(json.dumps({'zip':str(dest),'bytes':dest.stat().st_size,'models':1000,'metadata':1000,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}))
