"""Build selected recipes on the unchanged v1 rig; export and render actual GLBs."""
import bpy,sys,json
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; ROOT=Path(args[0]).resolve()
recipes=json.loads((ROOT/(args[1] if len(args)>1 else 'sample-recipes.json')).read_text())
if len(args)>2: recipes=[r for r in recipes if r['token_id']==int(args[2])]
(ROOT/'sample/models').mkdir(parents=True,exist_ok=True); (ROOT/'sample/renders').mkdir(exist_ok=True)
def linear(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def recolor(mat,hexcolor):
    color=tuple(linear(int(hexcolor[i:i+2],16)/255) for i in [1,3,5])+(1,)
    mat.diffuse_color=color; mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
for recipe in recipes:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/01-base.blend'))
    rig=bpy.data.objects['CryptoDoodz_Rig']; src=recipe['sources']
    if src['outfit']=='35-tracksuit': src['trousers']='35-tracksuit'
    for slot in ['hair','headwear','facial_hair','eyewear','outfit','neckwear','earwear','backwear','trousers']:
        if slot not in src: continue
        # Keep existing base parts; appending the currently open .blend can crash Blender 4.0.
        if src[slot]=='01-base': continue
        for o in list(bpy.context.scene.objects):
            if o.type=='MESH' and o.get('trait_slot')==slot: bpy.data.objects.remove(o,do_unlink=True)
        if not src[slot]: continue
        with bpy.data.libraries.load(str(ROOT/'source'/f'{src[slot]}.blend'),link=False) as (available,loaded): loaded.objects=available.objects
        parts=[o for o in loaded.objects if o and o.type=='MESH' and o.get('trait_slot')==slot]
        assert parts,(slot,src[slot])
        for o in parts:
            bpy.context.scene.collection.objects.link(o); o.parent=rig
            for m in o.modifiers:
                if m.type=='ARMATURE': m.object=rig
        for o in loaded.objects:
            if o and o not in parts: bpy.data.objects.remove(o,do_unlink=True)
    # Per-slot material copies prevent a shoe color from changing the trousers or eyes.
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.name=='Ground': continue
        slot=o.get('trait_slot'); color=None
        if slot in ['hair','brows','facial_hair']: color=src['hair_color']
        if slot=='trousers' and not o.name.startswith('tracksuit_'): color=src['trousers_color']
        if slot=='shoes' and not o.name.startswith('shoe_sole'): color=src['shoes_color']
        if slot=='body' and o.data.materials and o.data.materials[0].name.split('.')[0]=='skin': color=src['skin']
        if color:
            mat=o.data.materials[0].copy(); o.data.materials[0]=mat; recolor(mat,color)
    retained={s.action for t in rig.animation_data.nla_tracks for s in t.strips}
    for a in list(bpy.data.actions):
        if a not in retained: bpy.data.actions.remove(a)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o==rig or o.type=='EMPTY' or (o.type=='MESH' and o.name!='Ground'): o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    ident=f"{recipe['token_id']:04}"
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'sample/models'/f'{ident}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_nla_strips=True,export_force_sampling=True,export_frame_range=False,export_def_bones=True)
    scene=bpy.context.scene; scene.frame_set(0)
    recolor(bpy.data.objects['Ground'].data.materials[0],src['background'])
    scene.render.resolution_x=450; scene.render.resolution_y=560
    scene.render.filepath=str(ROOT/'sample/renders'/f'{ident}.png'); bpy.ops.render.render(write_still=True)
print('SAMPLE_COMPLETE')
