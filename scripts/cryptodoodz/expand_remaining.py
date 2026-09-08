"""Remaining brainstorm traits, using the v1 skeleton. Puffer excluded from active assets."""
import bpy,sys,json,shutil,math
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; DEST=Path(args[0]).resolve(); BASE=Path(args[1]).resolve()
exec(compile(Path(__file__).with_name('build.py').read_text().split('manifest={')[0],'build.py','exec'),globals())
for folder in ['models','traits','source','renders']:
    (DEST/folder).mkdir(parents=True,exist_ok=True)
    for p in (BASE/folder).glob('*'):
        if p.is_file() and p.suffix in ['.glb','.blend','.png'] and 'puffer' not in p.name.lower(): shutil.copy2(p,DEST/folder/p.name)
entries=[('20-flat-top','hair'),('21-locs','hair'),('22-ponytail','hair'),('23-stubble','facial_hair'),('24-handlebar','facial_hair'),('25-chinstrap','facial_hair'),('26-long-beard','facial_hair'),('27-cowboy','headwear'),('28-hard-hat','headwear'),('29-sailor','headwear'),('30-round-shades','eyewear'),('31-goggles','eyewear'),('32-visor','eyewear'),('33-eyepatch','eyewear'),('34-denim-vest','outfit'),('35-tracksuit','outfit'),('36-suit-tie','outfit'),('37-earrings','earwear'),('38-bow-tie','neckwear'),('39-backpack','backwear')]
for ident,slot in entries:
    if len(args)>2 and ident!=args[2]: continue
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'source/01-base.blend')); RIG=bpy.data.objects['CryptoDoodz_Rig']
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and (o.get('trait_slot')==slot or (slot=='headwear' and o.get('trait_slot')=='hair')): bpy.data.objects.remove(o,do_unlink=True)
    dark=material('new_black','#25232A'); blue=material('new_denim','#41637D'); cream=material('new_cream','#D8D3C3'); gold=material('new_gold','#B88A36'); red=material('new_red','#8A3542'); brown=material('new_brown','#765037'); lens=material('new_lens','#203E50')
    def part(n,p,s,m=dark,bone='head',bevel=.004): return cube(ident+'_'+n,p,s,m,bone,slot,bevel)
    def ring(n,loc,r,minor,mat=gold,bone='head'):
        bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=4,location=loc,major_radius=r,minor_radius=minor,rotation=(math.pi/2,0,0))
        o=bpy.context.object; o.name=ident+'_'+n; o.data.materials.append(mat); o['trait_slot']=slot; o.parent=RIG
        g=o.vertex_groups.new(name=bone); g.add(list(range(len(o.data.vertices))),1,'REPLACE'); mod=o.modifiers.new('rig','ARMATURE'); mod.object=RIG
        return o
    if ident=='20-flat-top':
        part('hair',(0,.01,2.14),(.69,.55,.20),bevel=.01)
        for x in [-.324,.324]: part('side',(x,.04,2.005),(.047,.46,.14))
    elif ident=='21-locs':
        part('crown',(0,.015,2.08),(.69,.55,.10))
        for i in range(5):
            for j in range(3):
                o=part('loc',((i-2)*.14,(j-1)*.17,2.17),(.092,.105,.21),bevel=.012); o.rotation_euler[1]=-.18+(i%3)*.15
        for x in [-.32,.32]:
            for y in [.08,.21]: part('side_loc',(x,y,1.96),(.088,.095,.28),bevel=.01)
    elif ident=='22-ponytail':
        part('crown',(0,.035,2.09),(.69,.53,.13))
        part('back',(0,.25,1.97),(.66,.07,.21))
        part('tie',(0,.31,1.965),(.17,.085,.075),gold)
        part('tail',(0,.354,1.815),(.18,.14,.31),bevel=.014)
    elif ident=='23-stubble':
        for row,z in enumerate([1.50,1.53,1.56]):
            for i in range(13): part('stubble',((i-6)*.041,-.268,z+((i+row)%2)*.008),(.014,.007,.015),bevel=0)
        for x in [-.29,.29]: part('sideburn',(x,-.255,1.64),(.035,.022,.15))
    elif ident=='24-handlebar':
        for sign in [-1,1]:
            part('mustache',(sign*.091,-.297,1.663),(.18,.065,.043))
            part('curl_outer',(sign*.198,-.297,1.695),(.037,.065,.10))
            part('curl_tip',(sign*.174,-.297,1.736),(.071,.065,.028))
    elif ident=='25-chinstrap':
        part('chin',(0,-.265,1.488),(.53,.045,.042))
        for x in [-.28,.28]: part('strap',(x,-.253,1.60),(.041,.053,.25))
    elif ident=='26-long-beard':
        part('lower',(0,-.26,1.448),(.44,.13,.22),bevel=.013)
        part('tip',(0,-.253,1.32),(.30,.12,.06),bevel=.01)
        for x in [-.263,.263]: part('side',(x,-.248,1.62),(.12,.14,.31))
        for x in [-.082,.082]: part('mustache',(x,-.29,1.666),(.17,.062,.047))
    elif ident=='27-cowboy':
        part('crown',(0,0,2.17),(.61,.48,.25),brown,bevel=.018)
        part('brim',(0,0,2.038),(.94,.72,.044),brown)
        for x in [-.455,.455]:
            o=part('raised_brim',(x,0,2.075),(.085,.66,.042),brown); o.rotation_euler[1]=(.36 if x<0 else -.36)
        part('band',(0,0,2.082),(.624,.494,.052),dark)
        part('buckle',(0,-.252,2.082),(.055,.02,.047),gold)
    elif ident=='28-hard-hat':
        yellow=material('hardhat_yellow','#DDA52D')
        part('crown',(0,0,2.13),(.72,.59,.20),yellow,bevel=.025)
        part('brim',(0,-.03,2.034),(.78,.70,.044),yellow)
        for x in [-.20,0,.20]: part('ridge',(x,0,2.237),(.043,.48,.04),yellow)
    elif ident=='29-sailor':
        part('rim',(0,0,2.056),(.76,.61,.095),cream)
        part('crown',(0,.01,2.16),(.61,.48,.15),cream,bevel=.025)
        part('band',(0,-.31,2.058),(.45,.01,.029),blue)
    elif ident=='30-round-shades':
        for x in [-.157,.157]:
            ring('rim',(x,-.329,1.813),.092,.014,dark)
            bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.084,depth=.017,location=(x,-.323,1.813),rotation=(math.pi/2,0,0))
            o=bpy.context.object; o.name=ident+'_lens'; o.data.materials.append(lens); o['trait_slot']=slot; o.parent=RIG
            g=o.vertex_groups.new(name='head'); g.add(list(range(len(o.data.vertices))),1,'REPLACE'); mod=o.modifiers.new('rig','ARMATURE'); mod.object=RIG
        part('bridge',(0,-.332,1.83),(.14,.029,.022))
        for x in [-.30,.30]: part('arm',(x,-.10,1.84),(.024,.45,.024))
    elif ident in ['31-goggles','32-visor']:
        part('frame',(0,-.31,1.827),(.61,.073,.19),blue,bevel=.014)
        part('glass',(0,-.352,1.827),(.55,.014,.137),lens,bevel=.012)
        if ident=='31-goggles':
            for x in [-.332,.332]: part('strap',(x,.0,1.836),(.034,.52,.062))
            part('nose_gap',(0,-.362,1.762),(.095,.016,.035),blue)
        else:
            for x in [-.325,.325]: part('temple',(x,-.145,1.843),(.025,.31,.038),gold)
            part('highlight',(0,-.364,1.868),(.51,.008,.012),gold)
    elif ident=='33-eyepatch':
        part('patch',(-.152,-.299,1.817),(.17,.035,.15),bevel=.016)
        for sign in [-1,1]:
            o=part('front_strap',(sign*.197,-.281,1.864),(.25,.019,.022)); o.rotation_euler[1]=sign*.20
            part('side_strap',(sign*.337,.0,1.89),(.025,.52,.024))
    elif ident in ['34-denim-vest','35-tracksuit','36-suit-tie']:
        mat=blue if ident=='34-denim-vest' else (red if ident=='35-tracksuit' else dark)
        part('torso',(0,0,1.17),(.625,.374,.44),mat,'spine')
        for side,x in [('L',.38),('R',-.38)]:
            part('sleeve',(x,0,1.24),(.206,.256,.20),cream if ident=='34-denim-vest' else mat,'upper_arm.'+side)
            if ident!='34-denim-vest':
                part('upper',(x,0,1.117),(.205,.255,.10),mat,'upper_arm.'+side)
                part('lower',(x,0,.924),(.188,.227,.225),mat,'forearm.'+side)
            if ident=='35-tracksuit':
                for dx in [-.037,.037]:
                    part('stripe',(x+dx,-.131,1.20),(.016,.009,.31),cream,'upper_arm.'+side)
                    part('stripe',(x+dx,-.119,.922),(.016,.009,.22),cream,'forearm.'+side)
        part('placket',(0,-.20,1.18),(.026,.019,.37),cream if ident=='35-tracksuit' else gold,'spine')
        if ident=='34-denim-vest':
            for x in [-.18,.18]: part('pocket',(x,-.20,1.265),(.13,.025,.09),blue,'spine')
            for x in [-.115,.115]:
                o=part('collar',(x,-.195,1.357),(.15,.035,.085),blue,'spine'); o.rotation_euler[1]=x*2
        if ident=='36-suit-tie':
            part('shirt',(0,-.203,1.286),(.15,.018,.20),cream,'spine')
            for x in [-.126,.126]:
                o=part('lapel',(x,-.22,1.30),(.10,.025,.23),dark,'spine'); o.rotation_euler[1]=-x*2
            part('tie',(0,-.233,1.26),(.041,.022,.15),red,'spine')
            part('knot',(0,-.237,1.343),(.055,.025,.04),red,'spine')
        if ident=='35-tracksuit':
            for side,x in [('L',.171),('R',-.171)]:
                for dx in [-.038,.038]:
                    cube('tracksuit_thigh_stripe',(x+dx,-.138,.677),(.014,.009,.35),cream,'thigh.'+side,'trousers',.002)
                    cube('tracksuit_shin_stripe',(x+dx,-.126,.315),(.014,.009,.335),cream,'shin.'+side,'trousers',.002)
    elif ident=='37-earrings':
        for x in [-.373,.373]: ring('hoop',(x,-.072,1.657),.034,.008,gold)
    elif ident=='38-bow-tie':
        for x in [-.048,.048]: part('wing',(x,-.202,1.36),(.083,.042,.06),red,'spine',bevel=.008)
        part('knot',(0,-.212,1.36),(.032,.045,.037),dark,'spine')
    elif ident=='39-backpack':
        part('pack',(0,.333,1.16),(.43,.24,.42),blue,'spine',bevel=.02)
        part('pocket',(0,.471,1.08),(.31,.058,.16),brown,'spine',bevel=.008)
        for x in [-.205,.205]:
            part('strap_front',(x,-.215,1.205),(.039,.025,.36),brown,'spine')
            part('strap_top',(x,0,1.399),(.039,.43,.037),brown,'spine')
    assets=[o for o in bpy.context.scene.objects if o==RIG or o.type=='EMPTY' or (o.type=='MESH' and o.name!='Ground')]
    export(DEST/'models'/f'{ident}.glb',assets); export(DEST/'traits'/f'{ident}-{slot}.glb',[RIG]+[o for o in assets if o.type=='MESH' and o.get('trait_slot')==slot])
    if ident=='35-tracksuit': export(DEST/'traits'/f'{ident}-trousers.glb',[RIG]+[o for o in assets if o.type=='MESH' and o.get('trait_slot')=='trousers'])
    bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'source'/f'{ident}.blend'))
    scene=bpy.context.scene; scene.render.filepath=str(DEST/'renders'/f'{ident}.png'); bpy.ops.render.render(write_still=True)
manifest=json.loads((BASE/'manifest.json').read_text()); manifest['version']='1.3.0'; manifest.pop('files',None)
manifest['expansion_traits']=[t for t in manifest['expansion_traits'] if 'puffer' not in t['id']]
manifest['expansion_traits'] += [{'id':i,'base':'01-base','slot':s,'file':f'traits/{i}-{s}.glb','source':f'source/{i}.blend'} for i,s in entries]
manifest['compatibility']={'status':'See trait-catalog.json and plan_collection.py for active rules.'}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('REMAINING_TRAITS_COMPLETE')
