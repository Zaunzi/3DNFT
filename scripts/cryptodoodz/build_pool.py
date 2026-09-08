"""Extend v1 with six more reusable traits for collection sampling."""
import bpy,sys,json,shutil
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; DEST=Path(args[0]).resolve(); BASE=Path(args[1]).resolve()
exec(compile(Path(__file__).with_name('build.py').read_text().split('manifest={')[0], 'build.py','exec'),globals())
for folder in ['models','traits','source','renders']:
    (DEST/folder).mkdir(parents=True,exist_ok=True)
    for p in (BASE/folder).glob('*'):
        if p.is_file() and p.suffix in ['.glb','.blend','.png','.jpg','.gif']: shutil.copy2(p,DEST/folder/p.name)
entries=[('14-curly','hair'),('15-buzz','hair'),('16-durag','headwear'),('17-overalls','outfit'),('18-puffer','outfit'),('19-chain','neckwear')]
for ident,slot in entries:
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'source/01-base.blend'))
    RIG=bpy.data.objects['CryptoDoodz_Rig']
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and (o.get('trait_slot')==slot or (ident=='16-durag' and o.get('trait_slot')=='hair')): bpy.data.objects.remove(o,do_unlink=True)
    dark=material('pool_dark','#25232A'); blue=material('pool_denim','#456884'); cream=material('pool_cream','#DDD8C7'); gold=material('pool_gold','#BD8D35'); teal=material('pool_teal','#267472')
    def part(name,loc,size,mat=dark,bone='head',bevel=.004): return cube(ident+'_'+name,loc,size,mat,bone,slot,bevel)
    if ident=='14-curly':
        part('crown',(0,0,2.077),(.69,.55,.12))
        for i in range(5):
            for j in range(4):
                z=2.13+.024*((i*3+j)%3)
                o=part('curl',((i-2)*.133,(j-1.5)*.13,z),(.15,.145,.145),bevel=.026); o.rotation_euler[2]=.12*((i+j)%3-1)
    elif ident=='15-buzz':
        part('top',(0,.012,2.088),(.68,.54,.06),bevel=.014)
        part('back',(0,.255,1.994),(.67,.032,.18))
        for x in [-.325,.325]: part('side',(x,.035,2.02),(.029,.45,.15))
    elif ident=='16-durag':
        part('crown',(0,.008,2.089),(.695,.558,.085),teal,bevel=.014)
        part('band',(0,0,2.021),(.705,.565,.069),teal)
        part('seam',(0,0,2.139),(.017,.53,.009),cream)
        part('knot',(0,.314,2.02),(.12,.10,.073),teal)
        for x in [-.05,.05]:
            o=part('tail',(x,.31,1.88),(.065,.037,.27),teal); o.rotation_euler[1]=x*2
    elif ident in ['17-overalls','18-puffer']:
        part('shirt',(0,0,1.17),(.62,.365,.44),cream,'spine')
        for s,x in [('L',.38),('R',-.38)]: part('sleeve',(x,0,1.24),(.205,.255,.20),cream,'upper_arm.'+s)
        if ident=='17-overalls':
            part('bib',(0,-.196,1.17),(.35,.04,.25),blue,'spine')
            part('waist',(0,0,.99),(.625,.38,.12),blue,'spine')
            for x in [-.136,.136]:
                part('strap',(x,-.184,1.322),(.055,.036,.18),blue,'spine')
                part('button',(x,-.219,1.265),(.031,.017,.027),gold,'spine')
            part('pocket',(0,-.222,1.17),(.155,.016,.086),blue,'spine')
        else:
            for x in [-.183,.183]:
                for i in range(4): part('padded_panel',(x,-.02,1.015+i*.093),(.257,.40,.087),teal,'spine',bevel=.013)
            for x in [-.12,.12]: part('collar',(x,0,1.396),(.11,.32,.08),teal,'spine')
            part('zip',(0,-.227,1.165),(.023,.015,.39),gold,'spine')
    elif ident=='19-chain':
        for i in range(13):
            x=(i-6)*.025; z=1.305+.082*(abs(i-6)/6)**1.5
            o=part('link',(x,-.218,z),(.028,.024,.033),gold,'spine',bevel=.006); o.rotation_euler[1]=(i-6)*.095
        part('pendant',(0,-.234,1.251),(.065,.026,.068),gold,'spine',bevel=.007)
    assets=[o for o in bpy.context.scene.objects if o==RIG or o.type=='EMPTY' or (o.type=='MESH' and o.name!='Ground')]
    export(DEST/'models'/f'{ident}.glb',assets)
    export(DEST/'traits'/f'{ident}-{slot}.glb',[RIG]+[o for o in assets if o.type=='MESH' and o.get('trait_slot')==slot])
    bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'source'/f'{ident}.blend'))
    scene=bpy.context.scene; scene.render.filepath=str(DEST/'renders'/f'{ident}.png'); bpy.ops.render.render(write_still=True)
manifest=json.loads((BASE/'manifest.json').read_text()); manifest['version']='1.2.0'; manifest.pop('files',None)
manifest['expansion_traits'] += [{'id':i,'base':'01-base','slot':s,'file':f'traits/{i}-{s}.glb','source':f'source/{i}.blend'} for i,s in entries]
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('POOL_COMPLETE')
