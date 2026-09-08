"""Render animation previews and test GLB reimport in Blender."""
import bpy, sys, json
from pathlib import Path
ROOT=Path(sys.argv[sys.argv.index('--')+1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/01-base.blend'))
rig=bpy.data.objects['CryptoDoodz_Rig']; scene=bpy.context.scene
scene.render.resolution_x=300; scene.render.resolution_y=380; scene.eevee.taa_render_samples=24
scene.camera.data.ortho_scale=3.6
folder=ROOT/'renders/motion'; folder.mkdir(exist_ok=True)
for track in rig.animation_data.nla_tracks: track.mute=True
for name,end in [('Idle',48),('Walk',24),('Run',18),('Jump',32),('Shoot',16),('Wave',48)]:
    if '--reimport-only' in sys.argv: break
    track=next(t for t in rig.animation_data.nla_tracks if t.name==name); track.mute=False
    for i in range(16):
        scene.frame_set(round(i*end/16)); scene.render.filepath=str(folder/f'{name}-{i:02}.png'); bpy.ops.render.render(write_still=True)
    track.mute=True
# Reimport an exported GLB to verify Blender can actually decode meshes, skins, and actions.
bpy.ops.object.select_all(action='DESELECT')
for o in list(scene.objects):
    if o.type in ['ARMATURE','EMPTY'] or (o.type=='MESH' and o.name!='Ground'): bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/01-base.glb'))
rig=next(o for o in scene.objects if o.type=='ARMATURE')
assert len(rig.data.bones)==16
assert rig.animation_data and len(rig.animation_data.nla_tracks)>=6
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks: t.mute=True
track=next(t for t in rig.animation_data.nla_tracks if 'Shoot' in t.name); track.mute=False
scene.frame_set(8); scene.render.filepath=str(ROOT/'renders/glb-reimport-shoot.png'); bpy.ops.render.render(write_still=True)
(ROOT/'reimport-validation.json').write_text(json.dumps({'status':'pass','file':'models/01-base.glb','bones':len(rig.data.bones),'tracks':[t.name for t in rig.animation_data.nla_tracks],'evidence':'renders/glb-reimport-shoot.png'},indent=2))
