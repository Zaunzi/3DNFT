import json,sys,hashlib,zipfile,shutil,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(sys.argv[1]).resolve()
recipes=json.loads((ROOT/'sample-recipes.json').read_text())
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',32); small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
board=Image.new('RGB',(1200,76+438*math.ceil(len(recipes)/4)),'#EFEEE9'); draw=ImageDraw.Draw(board)
draw.text((24,15),'CryptoDoodz / v1 collection sample',font=font,fill='#22252B')
for i,r in enumerate(recipes):
    ident=f"{r['token_id']:04}"; im=Image.open(ROOT/'sample/renders'/f'{ident}.png').convert('RGB').resize((296,368))
    x=i%4*300; y=64+i//4*438; board.paste(im,(x,y))
    draw.text((x+10,y+374),f"#{ident} / {r['traits']['outfit']}",font=small,fill='#22252B')
    text=' / '.join(r['traits'][k] for k in ['hair','headwear','eyewear'] if r['traits'][k] not in ['None','Bald'])
    draw.text((x+10,y+398),text,font=small,fill='#55575B')
board.save(ROOT/'sample/lineup.jpg',quality=95)
(ROOT/'scripts').mkdir(exist_ok=True)
for name in ['build.py','expand_v1.py','expand_remaining.py','compose.py','plan_collection.py','render_sample.py','verify.py','audit_collection.py','package_collection.py']:
    shutil.copy2(Path(__file__).with_name(name),ROOT/'scripts'/name)
files=[p for p in ROOT.rglob('*') if p.is_file() and p.suffix not in ['.log','.blend1'] and p.name!='SHA256SUMS.json']
(ROOT/'SHA256SUMS.json').write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},indent=2))
dest=ROOT.parent/('CryptoDoodz-v1-collection-r2.zip' if ROOT.name.endswith('-r2') else 'CryptoDoodz-v1-collection-preview.zip')
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files+[ROOT/'SHA256SUMS.json']: z.write(p,'CryptoDoodz/'+str(p.relative_to(ROOT)))
with zipfile.ZipFile(dest) as z: assert z.testzip() is None
print('Packaged',dest)
