"""Reimport repaired production GLBs and render beard joins and bent sleeves."""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=root/'review';out.mkdir(exist_ok=True)
tokens=[1,4,6]
if '--all-outfits' in sys.argv:
    recipes=json.loads((root/'recipes.json').read_text())
    changes=json.loads((root.parent/'cryptodoodz-collection-r11/repair-r11.json').read_text())
    tokens=sorted(set(tokens+[next(r['token_id'] for r in recipes if r['sources']['outfit']==c['source'])
        for c in changes if c['slot']=='outfit']))
for token in tokens:
    bpy.ops.wm.open_mainfile(filepath=str(root.parent/'cryptodoodz-collection-r11/source/01-base.blend'))
    scene=bpy.context.scene
    for o in list(scene.objects):
        if o.type in ['ARMATURE','EMPTY'] or (o.type=='MESH' and o.name!='Ground'):
            bpy.data.objects.remove(o,do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(root/'models'/f'{token:04}.glb'))
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    rig.animation_data.action=None
    for track in rig.animation_data.nla_tracks: track.mute=True
    scene.render.resolution_x=640;scene.render.resolution_y=640
    scene.eevee.taa_render_samples=32
    beard=token in [4,6]
    target=Vector((0,0,1.68 if beard else 1.25))
    scene.camera.location=(2,-6,2.3)
    scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.ortho_scale=1.05 if beard else 1.5
    for clip,frame in [('Rest',0),('Wave',18),('Shoot',8)]:
        if beard and clip!='Rest': continue
        for track in rig.animation_data.nla_tracks: track.mute=track.name!=clip
        scene.frame_set(frame)
        scene.render.filepath=str(out/f'{token:04}-{clip}.png')
        bpy.ops.render.render(write_still=True)
print('R11_REVIEW_COMPLETE',flush=True)
