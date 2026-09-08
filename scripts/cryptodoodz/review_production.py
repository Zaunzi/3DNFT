"""Reimport and render a coverage sample from the actual production GLB files."""
import bpy,sys,json
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; SRC=Path(args[0]).resolve(); OUT=Path(args[1]).resolve()
recipes=json.loads((SRC/'sample-recipes.json').read_text()); (OUT/'review').mkdir(exist_ok=True)
receipts=[]
for i,r in enumerate(recipes):
    bpy.ops.wm.open_mainfile(filepath=str(SRC/'source/01-base.blend'));scene=bpy.context.scene
    for o in list(scene.objects):
        if o.type in ['ARMATURE','EMPTY'] or (o.type=='MESH' and o.name!='Ground'):bpy.data.objects.remove(o,do_unlink=True)
    ident=f"{r['token_id']:04}";bpy.ops.import_scene.gltf(filepath=str(OUT/'models'/f'{ident}.glb'))
    rig=next(o for o in scene.objects if o.type=='ARMATURE');assert len(rig.data.bones)==16
    rig.animation_data.action=None
    for t in rig.animation_data.nla_tracks:t.mute=True
    assert {t.name for t in rig.animation_data.nla_tracks}=={'Idle','Walk','Run','Jump','Shoot','Wave'}
    scene.frame_set(0);scene.render.resolution_x=360;scene.render.resolution_y=450
    scene.render.filepath=str(OUT/'review'/f'{ident}.png');bpy.ops.render.render(write_still=True)
    if i<6:
        clip=['Idle','Walk','Run','Jump','Shoot','Wave'][i]
        next(t for t in rig.animation_data.nla_tracks if t.name==clip).mute=False
        scene.camera.data.ortho_scale=3.6;scene.frame_set({'Idle':12,'Walk':6,'Run':6,'Jump':16,'Shoot':8,'Wave':24}[clip])
        scene.render.filepath=str(OUT/'review'/f'{ident}-{clip}.png');bpy.ops.render.render(write_still=True)
    receipts.append({'token_id':r['token_id'],'bones':16,'clips':6,'status':'reimported and rendered'})
(OUT/'reimport-review.json').write_text(json.dumps(receipts,indent=2));print('PRODUCTION_REVIEW_COMPLETE')
