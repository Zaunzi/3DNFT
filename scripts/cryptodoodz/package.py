"""Assemble rendered previews and a portable ZIP with source, exports, and receipts."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json,hashlib,zipfile,shutil,sys
ROOT=Path(__file__).resolve().parents[2]/'outputs/cryptodoodz-v1'
if (Path(__file__).resolve().parent.parent/'models').exists(): ROOT=Path(__file__).resolve().parent.parent
if len(sys.argv)>1: ROOT=Path(sys.argv[1]).resolve()
VERSION='v2' if ROOT.name.endswith('v2') else 'v1'
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',36)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
names=['01-base','02-skater','03-mechanic','04-punk','05-thinker','06-veteran']
board=Image.new('RGB',(1200,1160),'#eeeee9'); d=ImageDraw.Draw(board)
d.text((36,20),'CryptoDoodz / first six',font=font,fill='#22262b')
for i,name in enumerate(names):
    im=Image.open(ROOT/'renders'/f'{name}.png').convert('RGB'); im.thumbnail((392,496))
    x=4+(i%3)*400; y=78+(i//3)*540; board.paste(im,(x,y)); d.text((x+12,y+501),name.replace('-',' ').upper(),font=small,fill='#22262b')
board.save(ROOT/'renders/collection-lineup.jpg',quality=95)
if (ROOT/'renders/portrait-01-base.png').exists():
    board=Image.new('RGB',(1440,1090),'#eeeee9'); d=ImageDraw.Draw(board)
    d.text((24,16),'CryptoDoodz / sculpted low-poly revision',font=font,fill='#22262b')
    for i,name in enumerate(names):
        im=Image.open(ROOT/'renders'/f'portrait-{name}.png').convert('RGB').resize((476,476))
        x=(i%3)*480; y=64+(i//3)*510; board.paste(im,(x,y)); d.text((x+14,y+479),name.replace('-',' ').upper(),font=small,fill='#22262b')
    board.save(ROOT/'renders/portrait-lineup.jpg',quality=95)
clips=['Idle','Walk','Run','Jump','Shoot','Wave']; durations=[2,1,.75,32/24,16/24,2]
allframes=[]
for name,duration in zip(clips,durations):
    frames=[]
    for i in range(16):
        im=Image.open(ROOT/'renders/motion'/f'{name}-{i:02}.png').convert('RGB')
        canvas=Image.new('RGB',(300,420),'#eeeee9'); canvas.paste(im,(0,40)); ImageDraw.Draw(canvas).text((14,8),name.upper(),font=small,fill='#22262b'); frames.append(canvas)
    frames[0].save(ROOT/'renders'/f'{name.lower()}.gif',save_all=True,append_images=frames[1:],duration=round(duration*1000/16),loop=0,disposal=2)
for i in range(32):
    board=Image.new('RGB',(900,840),'#eeeee9')
    for j,(name,duration) in enumerate(zip(clips,durations)):
        f=int((i/16 % duration)/duration*16)%16
        im=Image.open(ROOT/'renders/motion'/f'{name}-{f:02}.png').convert('RGB')
        x=j%3*300; y=j//3*420; board.paste(im,(x,y+40)); ImageDraw.Draw(board).text((x+14,y+8),name.upper(),font=small,fill='#22262b')
    allframes.append(board)
allframes[0].save(ROOT/'renders/animation-board.gif',save_all=True,append_images=allframes[1:],duration=63,loop=0,disposal=2)
# Include reproducible scripts inside the package as well as in the project.
(ROOT/'scripts').mkdir(exist_ok=True)
for p in Path(__file__).parent.glob('*.py'):
    target=ROOT/'scripts'/p.name
    if p.resolve()!=target.resolve(): shutil.copy2(p,target)
files=[p for p in ROOT.rglob('*') if p.is_file() and p.suffix not in ['.blend1','.log'] and 'motion' not in p.parts and p.name!='SHA256SUMS.json']
(ROOT/'SHA256SUMS.json').write_text(json.dumps({str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},indent=2))
dest=ROOT.parent/f'CryptoDoodz-{VERSION}.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files+[ROOT/'SHA256SUMS.json']: z.write(p,f'CryptoDoodz-{VERSION}/'+str(p.relative_to(ROOT)))
with zipfile.ZipFile(dest) as z: assert z.testzip() is None
print('Packaged',dest,'bytes',dest.stat().st_size)
