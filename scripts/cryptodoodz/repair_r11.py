"""Repair facial-hair joins and extend existing sleeves without rerolling traits.

blender -b --python scripts/cryptodoodz/repair_r11.py -- NEW_LIBRARY R10_LIBRARY
"""
import bpy, sys, json, shutil
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
DEST, BASE = (Path(p).resolve() for p in args[:2])
if DEST.exists() and not (DEST/'repair-r11.json').exists():
    raise FileExistsError(DEST)
if not DEST.exists():
    shutil.copytree(BASE, DEST)
exec(compile(Path(__file__).with_name('build.py').read_text().split('manifest={')[0], 'build.py', 'exec'), globals())

def bind_mesh(name, vertices, faces, mat, slot):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj['trait_slot'] = slot
    obj.parent = RIG
    obj.vertex_groups.new(name='head').add(list(range(len(vertices))), 1, 'REPLACE')
    obj.modifiers.new('rig', 'ARMATURE').object = RIG
    return obj

def plate(name, points, mat):
    # A closed shallow extrusion, with one connected outline (including the fork).
    n = len(points)
    vertices = [(x, -.291 + depth, z) for depth in [0, .024] for x, z in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return bind_mesh(name, vertices, faces, mat, 'facial_hair')

def wrap(sign, bottom, top, mat):
    # Follow the chamfered cheek around the corner; the old sideburn ended behind
    # the face plane, leaving a skin-colored slit between the two beard pieces.
    path = [(.289, -.291), (.306, -.291), (.350, -.250), (.350, -.055)]
    vertices = [(sign*x, y, z) for z in [bottom, top] for x, y in path]
    faces = [(i, i+1, i+5, i+4) for i in range(3)]
    obj = bind_mesh('r11_cheek_wrap', vertices, faces, mat, 'facial_hair')
    modifier = obj.modifiers.new('Hair thickness', 'SOLIDIFY')
    modifier.thickness = .012
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)

changed = []
for source in sorted((BASE/'source').glob('*.blend')):
    ident = source.stem
    is_beard = ident in ['90-forked-beard', '112-muttonchops']
    if not is_beard and not (BASE/'traits'/f'{ident}-outfit.glb').exists():
        continue
    bpy.ops.wm.open_mainfile(filepath=str(source))
    RIG = bpy.data.objects['CryptoDoodz_Rig']
    slot = 'facial_hair' if is_beard else 'outfit'
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.get('trait_slot') == slot]
    if is_beard:
        hair = objects[0].data.materials[0]
        for obj in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        if ident == '90-forked-beard':
            plate('r11_connected_forked_beard', [(-.29,1.66),(-.23,1.66),(-.21,1.585),
                  (.21,1.585),(.23,1.66),(.29,1.66),(.29,1.51),(.19,1.35),
                  (.065,1.37),(0,1.465),(-.065,1.37),(-.19,1.35),(-.29,1.51)], hair)
            for sign in [-1,1]: wrap(sign, 1.53, 1.66, hair)
        else:
            for sign in [-1,1]:
                plate('r11_mutton_chop', [(sign*x,z) for x,z in
                      [(.245,1.81),(.29,1.81),(.30,1.62),(.26,1.55),
                       (.145,1.55),(.135,1.60),(.215,1.66),(.235,1.73)]], hair)
                wrap(sign, 1.61, 1.81, hair)
    else:
        repaired = 0
        for side in ['L', 'R']:
            # Only substantial forearm garments qualify. Wrist bands, watches,
            # short sleeves, and deliberately rolled sleeves stay untouched.
            candidates = [o for o in objects if any(g.name == 'forearm.'+side for g in o.vertex_groups)
                          and o.dimensions.x > .17 and o.dimensions.y > .21 and o.dimensions.z > .16]
            if not candidates:
                continue
            lower = max(candidates, key=lambda o: o.dimensions.z)
            pivot = RIG.data.bones['forearm.'+side].head_local
            # Extend the existing rigid sleeve ends just beyond the elbow pivot.
            # Preserve mesh topology, materials, width, cuffs and skin weights:
            # no extra joint/cap geometry, and no changes to hands or the rig.
            upper_candidates = [o for o in objects
                if any(g.name == 'upper_arm.'+side for g in o.vertex_groups)
                and o.dimensions.x > .17 and o.dimensions.y > .21
                and o.dimensions.z > .07]
            upper = min(upper_candidates, key=lambda o: min((o.matrix_world @ v.co).z for v in o.data.vertices))
            for obj, end, target in [(upper, 'bottom', pivot.z-.018), (lower, 'top', pivot.z+.028)]:
                points = [obj.matrix_world @ v.co for v in obj.data.vertices]
                bottom, top = min(p.z for p in points), max(p.z for p in points)
                new_bottom = min(bottom, target) if end == 'bottom' else bottom
                new_top = max(top, target) if end == 'top' else top
                inverse = obj.matrix_world.inverted()
                for vertex, point in zip(obj.data.vertices, points):
                    point.z = new_bottom + (point.z-bottom)/(top-bottom)*(new_top-new_bottom)
                    vertex.co = inverse @ point
                obj.data.update()
            repaired += 1
        if not repaired:
            continue
        assert repaired == 2, ident
    export(DEST/'traits'/f'{ident}-{slot}.glb', [RIG]+[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('trait_slot')==slot])
    export(DEST/'models'/f'{ident}.glb', [o for o in bpy.context.scene.objects if o == RIG or o.type=='EMPTY' or (o.type=='MESH' and o.name!='Ground')])
    bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'source'/f'{ident}.blend'))
    changed.append({'source':ident, 'slot':slot})
(DEST/'repair-r11.json').write_text(json.dumps(changed, indent=2), encoding='utf-8')
print('R11_REPAIRED', json.dumps(changed), flush=True)
