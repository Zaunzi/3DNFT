"""CryptoDoodz v1: deterministic original geometry, rigid-weight skeleton, modular traits.
Run: blender --background --python scripts/cryptodoodz/build.py -- outputs/cryptodoodz-v1
Coordinates: metres, Z up, facing -Y. All traits share the same rest-space origin.
"""
import bpy, math, json, sys, os, hashlib
from mathutils import Vector
from pathlib import Path

OUT = Path(sys.argv[sys.argv.index('--')+1]).resolve()
for folder in ['models', 'traits', 'renders', 'source']:
    (OUT/folder).mkdir(parents=True, exist_ok=True)
FPS=24
SKINS=['#CB946B','#65412F','#B98258','#D8A181','#946343','#D3A483']
VARIANTS=[
 dict(id='01-base',skin=0,hair='crop',hat=None,face=None,outfit='tee',color='#DED8C7',hair_color='#30251F',background='#8EAAC0'),
 dict(id='02-skater',skin=1,hair=None,hat='beanie',face=None,outfit='hoodie',color='#292E34',hair_color='#241B16',background='#D8A18E'),
 dict(id='03-mechanic',skin=2,hair=None,hat='cap',face='mustache',outfit='workshirt',color='#355776',hair_color='#30251F',background='#91AC99'),
 dict(id='04-punk',skin=3,hair='mohawk',hat=None,face=None,outfit='jacket',color='#25262D',hair_color='#A93125',background='#B0A1C4'),
 dict(id='05-thinker',skin=4,hair='sidepart',hat=None,face='glasses',outfit='shirt',color='#DCD0B6',hair_color='#28211E',background='#C8B183'),
 dict(id='06-veteran',skin=5,hair='sidepart',hat=None,face='beard',outfit='jacket',color='#3E5142',hair_color='#C0C3BF',background='#8CA4B6')]

def material(name, hexcolor):
    def linear(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
    m=bpy.data.materials.new(name); m.diffuse_color=(*[linear(int(hexcolor[i:i+2],16)/255) for i in (1,3,5)],1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Roughness'].default_value=.83
    return m

def cube(name, loc, scale, mat, bone=None, group='body', bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat); o['trait_slot']=group
    if bevel:
        m=o.modifiers.new('Tiny machined edges','BEVEL'); m.width=bevel; m.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=m.name)
    if bone:
        vg=o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
        mod=o.modifiers.new('CryptoDoodz rigid skin','ARMATURE'); mod.object=RIG; o.parent=RIG
    return o

def skeleton():
    global RIG
    data=bpy.data.armatures.new('CryptoDoodz_Skeleton_v1'); RIG=bpy.data.objects.new('CryptoDoodz_Rig',data)
    bpy.context.collection.objects.link(RIG); bpy.context.view_layer.objects.active=RIG; RIG.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    specs=[('root',(0,0,0),(0,0,.2),None),('pelvis',(0,0,.83),(0,0,1.03),'root'),('spine',(0,0,1.03),(0,0,1.4),'pelvis'),('head',(0,0,1.42),(0,0,1.94),'spine')]
    for s,x in [('L',.38),('R',-.38)]:
        specs.extend([(f'upper_arm.{s}',(x,0,1.34),(x,0,1.03),'spine'),(f'forearm.{s}',(x,0,1.03),(x,0,.79),f'upper_arm.{s}'),(f'hand.{s}',(x,0,.79),(x,0,.67),f'forearm.{s}'),(f'thigh.{s}',(x*.45,0,.87),(x*.45,0,.49),'pelvis'),(f'shin.{s}',(x*.45,0,.49),(x*.45,0,.12),f'thigh.{s}'),(f'foot.{s}',(x*.45,0,.12),(x*.45,-.19,.12),f'shin.{s}')])
    for name,h,t,parent in specs:
        b=data.edit_bones.new(name); b.head=h; b.tail=t
        if parent: b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT'); RIG.show_in_front=True
    RIG['forward']='-Y'; RIG['units']='metres'; RIG['rig_version']='1.0.0'; RIG['skinning']='rigid 1.0 weight per vertex'
    for name,bone,loc in [('socket_hand_R','hand.R',(-.38,-.07,.73)),('socket_hand_L','hand.L',(.38,-.07,.73)),('socket_head','head',(0,0,2.07)),('socket_back','spine',(0,.19,1.25))]:
        o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
        constraint=o.constraints.new('CHILD_OF'); constraint.target=RIG; constraint.subtarget=bone
        constraint.inverse_matrix=(RIG.matrix_world @ RIG.data.bones[bone].matrix_local).inverted()

def build(v):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    skeleton()
    skin=material('skin',SKINS[v['skin']]); hair=material('hair',v['hair_color']); cloth=material('outfit',v['color'])
    dark=material('charcoal','#26282D'); eyes=material('eyes','#191B1E'); mouth=material('mouth','#715039'); sole=material('sole','#DFD9CC'); metal=material('metal','#9EA7AB')
    cube('body_torso',(0,0,1.18),(.60,.34,.43),skin,'spine',bevel=.02)
    cube('body_pelvis',(0,0,.88),(.43,.30,.22),dark,'pelvis',bevel=.015)
    cube('body_neck',(0,0,1.43),(.25,.26,.19),skin,'head')
    cube('body_head',(0,0,1.77),(.67,.53,.63),skin,'head',bevel=.035)
    cube('face_nose',(0,-.313,1.77),(.115,.15,.205),skin,'head')
    for s,x in [('L',.38),('R',-.38)]:
        sign=1 if x>0 else -1
        cube('ear_'+s,(sign*.36,0,1.76),(.095,.16,.18),skin,'head')
        cube('eye_'+s,(sign*.147,-.269,1.81),(.052,.018,.07),eyes,'head')
        cube('brow_'+s,(sign*.15,-.286,1.889),(.18,.049,.045),hair,'head',group='brows')
        cube('body_upper_arm_'+s,(x,0,1.18),(.18,.23,.29),skin,'upper_arm.'+s,bevel=.009)
        cube('body_forearm_'+s,(x,0,.915),(.165,.20,.245),skin,'forearm.'+s,bevel=.008)
        cube('body_hand_'+s,(x,-.01,.716),(.17,.205,.15),skin,'hand.'+s,bevel=.008)
        cube('trousers_thigh_'+s,(x*.45,0,.678),(.19,.265,.365),dark,'thigh.'+s,group='trousers')
        cube('trousers_shin_'+s,(x*.45,0,.315),(.175,.24,.35),dark,'shin.'+s,group='trousers')
        cube('shoe_'+s,(x*.45,-.06,.085),(.21,.36,.16),dark,'foot.'+s,group='shoes',bevel=.012)
        cube('shoe_sole_'+s,(x*.45,-.06,.025),(.217,.367,.038),sole,'foot.'+s,group='shoes')
    cube('mouth',(0,-.269,1.606),(.16,.013,.018),mouth,'head')
    def trait(name,loc,size,mat=hair,bone='head',slot='hair'):
        return cube(name,loc,size,mat,bone,slot)
    if v['hair'] in ['crop','sidepart']:
        trait('hair_crown',(0,.015,2.073),(.70,.55,.12))
        trait('hair_back',(0,.252,1.954),(.69,.065,.23))
        for i in range(5):
            x=(i-2)*.135; h=.09+(i%3)*.028 if v['hair']=='crop' else .16-i*.022
            trait('hair_lock_'+str(i),(x,-.17,2.09+h/2),(.133,.28,h))
        for x in [-.315,.315]: trait('hair_temple',(x,.01,1.99),(.085,.48,.19))
    if v['hair']=='mohawk':
        for i in range(5): trait('mohawk_'+str(i),(0,-.21+i*.105,2.17+(.04 if i in [1,2] else 0)),(.14,.102,.27))
    if v['hat']=='beanie':
        orange=material('beanie_orange','#BD4F19')
        trait('beanie_cuff',(0,0,2.035),(.74,.59,.15),orange,slot='headwear')
        trait('beanie_crown',(0,.025,2.15),(.64,.51,.17),orange,slot='headwear')
        trait('beanie_top',(0,.025,2.25),(.46,.39,.07),orange,slot='headwear')
        for i in range(7): trait('beanie_rib_'+str(i),((i-3)*.10,-.299,2.035),(.018,.012,.14),orange,slot='headwear')
    if v['hat']=='cap':
        blue=material('cap_blue','#233D62')
        trait('cap_crown',(0,.01,2.115),(.73,.59,.20),blue,slot='headwear')
        trait('cap_brim',(0,-.365,2.028),(.76,.34,.045),blue,slot='headwear')
        trait('cap_patch',(0,-.293,2.12),(.16,.013,.07),sole,slot='headwear')
    if v['face'] in ['mustache','beard']:
        for x in [-.085,.085]: trait('mustache',(x,-.288,1.666),(.17,.066,.06),slot='facial_hair')
        if v['face']=='mustache':
            for x in [-.16,.16]: trait('mustache_end',(x,-.29,1.63),(.055,.066,.09),slot='facial_hair')
        else:
            trait('beard_chin',(0,-.248,1.493),(.52,.13,.13),slot='facial_hair')
            for x in [-.275,.275]: trait('beard_side',(x,-.245,1.62),(.12,.14,.33),slot='facial_hair')
            trait('beard_lower',(0,-.255,1.553),(.46,.13,.065),slot='facial_hair')
    if v['face']=='glasses':
        for x in [-.16,.16]:
            for z in [1.744,1.889]: trait('glasses_frame',(x,-.325,z),(.237,.038,.029),dark,slot='eyewear')
            for dx in [-.104,.104]: trait('glasses_frame',(x+dx,-.325,1.817),(.029,.038,.17),dark,slot='eyewear')
        trait('glasses_bridge',(0,-.325,1.83),(.09,.038,.024),dark,slot='eyewear')
        for x in [-.325,.325]: trait('glasses_arm',(x,-.11,1.855),(.028,.43,.025),dark,slot='eyewear')
    slot='outfit'; outfit=v['outfit']
    trait('outfit_torso',(0,0,1.17),(.62,.365,.44),cloth,'spine',slot)
    for s,x in [('L',.38),('R',-.38)]:
        trait('outfit_sleeve_'+s,(x,0,1.24),(.205,.255,.20),cloth,'upper_arm.'+s,slot)
        if outfit!='tee':
            trait('outfit_upper_'+s,(x,0,1.115),(.205,.255,.10),cloth,'upper_arm.'+s,slot)
            trait('outfit_lower_'+s,(x,0,.924),(.187,.225,.225),cloth,'forearm.'+s,slot)
    if outfit=='hoodie':
        trait('hood_back',(0,.20,1.35),(.41,.17,.19),cloth,'spine',slot)
        for x in [-.15,.15]: trait('hood_side',(x,0,1.395),(.11,.30,.09),cloth,'spine',slot)
        for x in [-.08,.08]: trait('hood_drawstring',(x,-.198,1.305),(.018,.018,.17),sole,'spine',slot)
        trait('hood_pocket',(0,-.194,1.07),(.32,.025,.105),cloth,'spine',slot)
    if outfit in ['shirt','workshirt','jacket']:
        trait('undershirt',(0,-.19,1.33),(.15,.025,.10),sole if outfit!='jacket' else dark,'spine',slot)
        for x in [-.10,.10]:
            o=trait('collar',(x,-.206,1.365),(.14,.04,.08),cloth,'spine',slot); o.rotation_euler[1]=(-.28 if x>0 else .28)
        trait('placket',(0,-.193,1.16),(.023,.025,.28),metal if outfit=='jacket' else cloth,'spine',slot)
        if outfit=='workshirt':
            for x in [-.19,.19]: trait('work_pocket',(x,-.193,1.23),(.13,.026,.11),cloth,'spine',slot)
    sys.path.insert(0, str(Path(__file__).parent))
    from refine_v2 import refine
    refine(v, RIG, cube, material)
    animate()
    return RIG

def animate():
    rig=RIG; rig.animation_data_create()
    clips={'Idle':48,'Walk':24,'Run':18,'Jump':32,'Shoot':16,'Wave':48}
    for name,end in clips.items():
        action=bpy.data.actions.new(name); rig.animation_data.action=action
        frames=range(0,end+1,2)
        for f in frames:
            t=f/end; phase=2*math.pi*t
            for p in rig.pose.bones:
                p.rotation_mode='XYZ'; p.rotation_euler=(0,0,0); p.location=(0,0,0)
            p=rig.pose.bones
            if name=='Idle':
                p['spine'].rotation_euler[0]=.016*math.sin(phase)
                p['head'].rotation_euler[2]=.035*math.sin(phase)
            if name in ['Walk','Run']:
                amp=.53 if name=='Walk' else .90
                for s,sgn in [('L',1),('R',-1)]:
                    a=math.sin(phase)*sgn
                    p['thigh.'+s].rotation_euler[0]=amp*a
                    p['shin.'+s].rotation_euler[0]=-max(0,-a)*amp*1.3
                    p['upper_arm.'+s].rotation_euler[0]=-amp*a*.75
                    p['forearm.'+s].rotation_euler[0]=.25 if name=='Walk' else .8
                p['root'].location[1]=(.018 if name=='Walk' else .035)*(1-math.cos(2*phase))
                p['spine'].rotation_euler[0]=.06 if name=='Walk' else .15
            if name=='Jump':
                # Anticipation, takeoff, airborne tuck, landing, return to bind stance.
                height=max(0,math.sin(math.pi*(t-.2)/.6))*.48 if .2<t<.8 else 0
                crouch=max(0,1-abs(t-.125)/.125)*.11+max(0,1-abs(t-.875)/.125)*.10
                p['root'].location[1]=height-crouch
                for s in ['L','R']:
                    p['thigh.'+s].rotation_euler[0]=crouch*3+height*.65
                    p['shin.'+s].rotation_euler[0]=-crouch*6-height*1.3
                    p['upper_arm.'+s].rotation_euler[0]=height*2
            if name=='Shoot':
                aim=min(1,t/.25,(1-t)/.25)
                recoil=max(0,1-abs(t-.5)/.125)
                p['upper_arm.R'].rotation_euler[0]=aim*1.48-recoil*.10
                p['forearm.R'].rotation_euler[0]=aim*.08+recoil*.18
                p['upper_arm.L'].rotation_euler[0]=aim*.40
                p['spine'].rotation_euler[0]=-recoil*.04
            if name=='Wave':
                a=min(1,t/.2,(1-t)/.2)
                p['upper_arm.L'].rotation_euler[2]=a*2.5
                p['forearm.L'].rotation_euler[2]=a*(.2+.28*math.sin(phase*3))
            # Downward limb bones have local +X pointing world +X: negative X raises arms forward.
            for bone in p:
                if bone.name.startswith(('upper_arm.','forearm.','thigh.','shin.')):
                    bone.rotation_euler[0] *= -1
                if bone.name.startswith(('upper_arm.L','forearm.L')):
                    bone.rotation_euler[2] *= -1
                bone.keyframe_insert('rotation_euler',frame=f,group=bone.name)
                bone.keyframe_insert('location',frame=f,group=bone.name)
        for fc in action.fcurves:
            for k in fc.keyframe_points: k.interpolation='LINEAR'
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new(); track.name=name
        strip=track.strips.new(name,0,action); strip.name=name; track.mute=True
    for bone in rig.pose.bones: bone.rotation_euler=(0,0,0); bone.location=(0,0,0)
    bpy.context.scene.frame_set(0)

def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=RIG
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_nla_strips=True,export_force_sampling=True,export_frame_range=False,export_def_bones=True,export_yup=True)

def studio(v):
    scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'; scene.eevee.use_gtao=True; scene.eevee.gtao_distance=3; scene.eevee.gtao_factor=1.25; scene.eevee.taa_render_samples=96
    scene.render.resolution_x=600; scene.render.resolution_y=760; scene.render.resolution_percentage=100
    scene.world.color=(.3,.3,.3); scene.view_settings.view_transform='Standard'; scene.view_settings.look='Medium High Contrast'
    bg=material('studio_background',v['background']); cube('Ground',(0,0,-.025),(200,200,.025),bg)
    for name,loc,power,size in [('Key',(-3,-4,6),450,4),('Fill',(4,-2,3),180,3),('Rim',(1,3,5),300,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(3,-6,3.0)); camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,1.14))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=2.85; scene.camera=camera
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'renders'/f"{v['id']}.png")

manifest={'name':'CryptoDoodz','version':'2.0.0','units':'metres','gltf_up':'+Y','gltf_forward':'+Z','height_m':2.285,'rig':'CryptoDoodz_Skeleton_v1','animation_fps':FPS,'clips':{'Idle':{'loop':True},'Walk':{'loop':True,'in_place':True},'Run':{'loop':True,'in_place':True},'Jump':{'loop':False},'Shoot':{'loop':False,'event':'fire','event_time_seconds':8/FPS},'Wave':{'loop':False}},'characters':VARIANTS,'traits':[],'provenance':{'geometry':'Original procedural geometry authored for this project; no external mesh or texture assets.','concept':'User-approved CryptoDoodz concept generated with built-in ImageGen.','license':'User project asset; no third-party asset license asserted.'}}
for idx,v in enumerate(VARIANTS):
    print('BUILDING',v['id'],flush=True)
    build(v); bpy.context.scene.render.fps=FPS
    asset_objects=[o for o in bpy.context.scene.objects if o.type in ['MESH','ARMATURE','EMPTY']]
    export(OUT/'models'/f"{v['id']}.glb",asset_objects)
    # Trait exports include the shared rig, preserving skin bind matrices for runtime rebinding.
    if idx==0:
        body=[o for o in asset_objects if o.type!='MESH' or o.get('trait_slot')=='body']
        export(OUT/'models'/'reusable-body.glb',body)
    for slot in sorted(set(o.get('trait_slot') for o in asset_objects if o.type=='MESH')):
        if slot=='body': continue
        filename=f"{v['id']}-{slot}.glb"
        export(OUT/'traits'/filename,[RIG]+[o for o in asset_objects if o.type=='MESH' and o.get('trait_slot')==slot])
        manifest['traits'].append({'character':v['id'],'slot':slot,'file':'traits/'+filename})
    studio(v)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/f"{v['id']}.blend"))
    bpy.ops.render.render(write_still=True)
    scene=bpy.context.scene
    cam=scene.camera
    full_location=cam.location.copy(); full_rotation=cam.rotation_euler.copy()
    cam.location=(3,-6,2.8)
    cam.rotation_euler=(Vector((0,0,1.86))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=1.48
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=bpy.data.materials['studio_background'].diffuse_color
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
    bpy.data.objects['Ground'].hide_render=True
    scene.render.resolution_x=720; scene.render.resolution_y=720
    scene.render.filepath=str(OUT/'renders'/f"portrait-{v['id']}.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects['Ground'].hide_render=False
    cam.location=full_location; cam.rotation_euler=full_rotation; cam.data.ortho_scale=3.6
    scene.render.resolution_x=600; scene.render.resolution_y=760
    if idx==0:
        track=next(t for t in RIG.animation_data.nla_tracks if t.name=='Shoot'); track.mute=False
        bpy.context.scene.frame_set(8); bpy.context.scene.render.filepath=str(OUT/'renders'/'pose-shoot.png'); bpy.ops.render.render(write_still=True)
        track.mute=True
        for clip,frame in [('Walk',6),('Jump',16),('Wave',24)]:
            track=next(t for t in RIG.animation_data.nla_tracks if t.name==clip); track.mute=False; bpy.context.scene.frame_set(frame)
            bpy.context.scene.render.filepath=str(OUT/'renders'/f'pose-{clip.lower()}.png'); bpy.ops.render.render(write_still=True); track.mute=True
manifest['files']={str(p.relative_to(OUT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file() and p.suffix in ['.glb','.blend','.png']}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('CRYPTODOODZ_BUILD_COMPLETE',flush=True)

