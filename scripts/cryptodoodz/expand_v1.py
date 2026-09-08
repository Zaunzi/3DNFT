"""Add six modular v1 traits, retaining the approved v1 geometry and rig.
blender --background --python scripts/cryptodoodz/expand_v1.py -- OUTPUT_DIR V1_DIR
"""
import bpy,sys,json,shutil,hashlib
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
DEST=Path(args[0]).resolve(); BASE=Path(args[1]).resolve()
if DEST==BASE: raise ValueError('Use a separate expansion directory.')
# Reuse only v1 helper definitions, never the v2 refinement or the build loop.
source=Path(__file__).with_name('build.py').read_text()
exec(compile(source.split("manifest={")[0],str(Path(__file__).with_name('build.py')),'exec'),globals())
for folder in ['models','traits','source','renders']:
    (DEST/folder).mkdir(parents=True,exist_ok=True)
    for p in (BASE/folder).glob('*'):
        if p.is_file() and p.suffix in ['.glb','.blend','.png','.jpg','.gif']: shutil.copy2(p,DEST/folder/p.name)
ENTRIES=[('08-shades','01-base','eyewear','Sunglasses'),('09-backward-cap','02-skater','headwear','Backward cap'),('10-bucket-hat','03-mechanic','headwear','Bucket hat'),('11-headphones','05-thinker','headwear','Headphones'),('12-goatee','01-base','facial_hair','Goatee'),('13-varsity','01-base','outfit','Varsity jacket')]
def remove_slot(slot):
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.get('trait_slot')==slot: bpy.data.objects.remove(o,do_unlink=True)

catalog=[]
for ident,base,slot,title in ENTRIES:
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'source'/f'{base}.blend'))
    RIG=bpy.data.objects['CryptoDoodz_Rig']
    remove_slot(slot)
    if ident in ['09-backward-cap','10-bucket-hat']: remove_slot('hair')
    black=material('expansion_black','#141922'); white=material('expansion_cream','#E3DCC6'); red=material('expansion_burgundy','#803444'); gold=material('expansion_gold','#C99542'); navy=material('expansion_navy','#284B64'); tan=material('expansion_khaki','#A89A6C')
    def part(name,loc,size,mat=black,bone='head',bevel=.004):
        return cube('trait_'+name,loc,size,mat,bone,slot,bevel)
    if ident=='08-shades':
        lens=material('sunglass_lens','#1E3740')
        for sign in [-1,1]:
            x=sign*.16
            part('sunglasses_lens',(x,-.322,1.813),(.207,.026,.128),lens)
            for z in [1.739,1.889]: part('sunglasses_rim',(x,-.33,z),(.247,.044,.025))
            for dx in [-.111,.111]: part('sunglasses_side',(x+dx,-.33,1.814),(.025,.044,.15))
            part('sunglasses_arm',(sign*.325,-.10,1.85),(.03,.44,.03))
            part('sunglasses_hinge',(sign*.277,-.337,1.856),(.021,.008,.018),gold)
        part('sunglasses_bridge',(0,-.339,1.835),(.095,.044,.027))
    elif ident=='09-backward-cap':
        part('cap_crown',(0,.012,2.125),(.72,.585,.20),red)
        part('cap_brim',(0,.377,2.042),(.75,.31,.035),red)
        part('cap_top',(0,.013,2.238),(.13,.13,.025),red)
        part('cap_strap',(0,-.29,2.057),(.255,.022,.038),black)
        part('cap_opening',(0,-.289,2.112),(.18,.023,.065),black)
        for x in [-.075,-.025,.025,.075]: part('cap_fastener',(x,-.305,2.057),(.01,.006,.01),gold,bevel=0)
    elif ident=='10-bucket-hat':
        part('bucket_crown',(0,0,2.145),(.69,.55,.22),tan)
        part('bucket_band',(0,0,2.064),(.704,.564,.05),navy)
        part('bucket_brim',(0,0,2.02),(.84,.71,.045),tan)
        part('bucket_top',(0,0,2.266),(.62,.49,.025),tan)
        for sign in [-1,1]:
            for y in [-.07,.07]: part('bucket_eyelet',(sign*.35,y,2.15),(.008,.025,.025),gold)
    elif ident=='11-headphones':
        # Band clears v1 cropped and side-part hair; hats need a separate fit.
        part('headphone_band_top',(0,.05,2.29),(.83,.11,.055),black)
        for sign in [-1,1]:
            part('headphone_band_side',(sign*.397,.05,2.10),(.045,.11,.36),black)
            part('headphone_cushion',(sign*.388,.025,1.78),(.09,.24,.26),black)
            part('headphone_shell',(sign*.449,.025,1.78),(.075,.245,.25),navy,bevel=.012)
            part('headphone_accent',(sign*.49,.025,1.78),(.013,.125,.12),gold)
    elif ident=='12-goatee':
        brown=material('goatee_dark_brown','#38291F')
        part('goatee_chin',(0,-.28,1.523),(.205,.07,.105),brown)
        part('goatee_soul_patch',(0,-.285,1.573),(.07,.034,.053),brown)
        for sign in [-1,1]:
            o=part('goatee_mustache',(sign*.073,-.29,1.666),(.143,.052,.035),brown); o.rotation_euler[1]=sign*.08
    elif ident=='13-varsity':
        part('varsity_torso',(0,0,1.17),(.625,.373,.44),red,'spine')
        for side,x in [('L',.38),('R',-.38)]:
            part('varsity_upper',(x,0,1.20),(.207,.26,.31),white,'upper_arm.'+side)
            part('varsity_lower',(x,0,.923),(.19,.228,.235),white,'forearm.'+side)
            part('varsity_cuff',(x,0,.828),(.196,.234,.052),navy,'forearm.'+side)
            part('varsity_cuff_stripe',(x,0,.834),(.20,.238,.012),white,'forearm.'+side)
        part('varsity_hem',(0,0,.971),(.63,.38,.048),navy,'spine')
        part('varsity_hem_stripe',(0,-.195,.975),(.625,.01,.012),white,'spine')
        part('varsity_placket',(0,-.193,1.17),(.042,.022,.36),navy,'spine')
        for z in [1.04,1.12,1.20,1.28]: part('varsity_button',(0,-.21,z),(.017,.012,.017),gold,'spine')
        for sign in [-1,1]:
            part('varsity_collar',(sign*.094,-.13,1.384),(.15,.11,.048),navy,'spine')
            o=part('varsity_pocket',(sign*.205,-.196,1.087),(.024,.018,.11),white,'spine'); o.rotation_euler[1]=sign*.25
        # Original geometric D patch, with no external brand logos.
        for x,z,w,h in [(-.19,1.264,.019,.10),(-.16,1.309,.064,.017),(-.16,1.219,.064,.017),(-.125,1.264,.018,.09)]: part('varsity_D_patch',(x,-.204,z),(w,.017,h),white,'spine')
    assets=[o for o in bpy.context.scene.objects if o==RIG or o.type=='EMPTY' or (o.type=='MESH' and o.name!='Ground')]
    export(DEST/'models'/f'{ident}.glb',assets)
    parts=[o for o in assets if o.type=='MESH' and o.get('trait_slot')==slot]
    export(DEST/'traits'/f'{ident}-{slot}.glb',[RIG]+parts)
    bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'source'/f'{ident}.blend'))
    scene=bpy.context.scene
    scene.render.filepath=str(DEST/'renders'/f'{ident}.png'); bpy.ops.render.render(write_still=True)
    scene.camera.location=(3,-6,2.8)
    scene.camera.rotation_euler=(Vector((0,0,1.76))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.ortho_scale=1.38
    scene.render.resolution_x=720; scene.render.resolution_y=720
    scene.render.filepath=str(DEST/'renders'/f'portrait-{ident}.png'); bpy.ops.render.render(write_still=True)
    if ident in ['11-headphones','13-varsity']:
        scene.camera.data.ortho_scale=3.6
        scene.camera.rotation_euler=(Vector((0,0,1.2))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        track=next(t for t in RIG.animation_data.nla_tracks if t.name=='Shoot'); track.mute=False
        scene.frame_set(8); scene.render.filepath=str(DEST/'renders'/f'pose-{ident}-shoot.png'); bpy.ops.render.render(write_still=True)
    catalog.append({'id':ident,'base':base,'slot':slot,'name':title,'file':f'traits/{ident}-{slot}.glb','source':f'source/{ident}.blend'})
manifest=json.loads((BASE/'manifest.json').read_text()); manifest['version']='1.1.0'; manifest['style']='User selected v1 voxel style; v2 is not the active art direction.'
manifest['expansion_traits']=catalog
manifest['compatibility']={'headwear':'Bucket hat and backward cap replace hair; headphones fit v1 crop and sidepart. Headwear slot is exclusive.','outfit':'Varsity jacket replaces the complete outfit slot; one shared skeleton.'}
manifest['files']={str(p.relative_to(DEST)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in DEST.rglob('*') if p.is_file() and p.suffix in ['.glb','.blend','.png']}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('V1_EXPANSION_COMPLETE')
