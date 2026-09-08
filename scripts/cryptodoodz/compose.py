"""Compose a new Dood from existing trait slots without rebuilding its rig.
blender --background --python scripts/cryptodoodz/compose.py -- CONFIG_JSON OUTPUT_GLB
"""
import bpy, json, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; config_path=Path(args[0]).resolve(); dest=Path(args[1]).resolve()
if dest.exists(): raise FileExistsError('Choose a new output filename: '+str(dest))
config=json.loads(config_path.read_text()); root=config_path.parent
bpy.ops.wm.open_mainfile(filepath=str(root/'source'/f"{config['base']}.blend"))
rig=bpy.data.objects['CryptoDoodz_Rig']
for slot,donor in config.get('slots',{}).items():
    assert slot in ['hair','brows','headwear','facial_hair','eyewear','outfit','trousers','shoes','neckwear','earwear','backwear']
    if donor==config['base']: continue
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.get('trait_slot')==slot: bpy.data.objects.remove(o,do_unlink=True)
    if donor is None: continue
    source=root/'source'/f'{donor}.blend'
    with bpy.data.libraries.load(str(source),link=False) as (available,loaded): loaded.objects=available.objects
    selected=[o for o in loaded.objects if o and o.type=='MESH' and o.get('trait_slot')==slot]
    if not selected: raise ValueError(f'{donor} has no {slot} trait')
    for o in selected:
        bpy.context.scene.collection.objects.link(o); o.parent=rig
        for mod in o.modifiers:
            if mod.type=='ARMATURE': mod.object=rig
    for o in loaded.objects:
        if o and o not in selected: bpy.data.objects.remove(o,do_unlink=True)
retained={strip.action for track in rig.animation_data.nla_tracks for strip in track.strips}
for action in list(bpy.data.actions):
    if action not in retained: bpy.data.actions.remove(action)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o==rig or (o.type=='MESH' and o.get('trait_slot') and o.name!='Ground') or o.name.startswith('socket_'): o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_animations=True,export_nla_strips=True,export_force_sampling=True,export_frame_range=False,export_def_bones=True)
print('COMPOSED',dest)
