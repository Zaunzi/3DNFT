"""Faceted sculptural profiles for CryptoDoodz, preserving the v1 bind skeleton."""
import bpy, math
from mathutils import Vector

def refine(v, rig, cube, material):
    def replace(o, verts, faces):
        bone=o.vertex_groups[0].name if o.vertex_groups else None
        mats=list(o.data.materials)
        mesh=bpy.data.meshes.new(o.name+'_faceted'); mesh.from_pydata([Vector(p)-o.location for p in verts],[],faces); mesh.update()
        o.data=mesh
        for m in mats: mesh.materials.append(m)
        if bone:
            o.vertex_groups.clear(); g=o.vertex_groups.new(name=bone); g.add(list(range(len(verts))),1,'REPLACE')
        return o
    def loft(o,rings):
        # (z, width, depth, center-y, chamfer-fraction), octagonal sections.
        verts=[]
        for z,w,d,y,c in rings:
            x=o.location.x; a=w/2; b=d/2
            verts.extend([(x-a+c*w,y-b,z),(x+a-c*w,y-b,z),(x+a,y-b+c*d,z),(x+a,y+b-c*d,z),(x+a-c*w,y+b,z),(x-a+c*w,y+b,z),(x-a,y+b-c*d,z),(x-a,y-b+c*d,z)])
        faces=[tuple(reversed(range(8)))]
        for k in range(len(rings)-1):
            for j in range(8): faces.append((k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j))
        faces.append(tuple(range((len(rings)-1)*8,len(rings)*8)))
        return replace(o,verts,faces)
    def obj(name): return bpy.data.objects.get(name)
    def remove(prefix):
        for o in list(bpy.context.scene.objects):
            if o.name.startswith(prefix): bpy.data.objects.remove(o,do_unlink=True)
    skin=obj('body_head').data.materials[0]; cloth=obj('outfit_torso').data.materials[0]; hair=obj('brow_L').data.materials[0]
    loft(obj('body_head'),[(1.445,.44,.40,-.006,.18),(1.48,.56,.46,-.015,.12),(1.61,.65,.53,0,.14),(1.82,.67,.53,0,.14),(2.015,.65,.53,.012,.13),(2.085,.57,.46,.02,.16)])
    loft(obj('body_neck'),[(1.35,.31,.29,0,.23),(1.49,.32,.31,0,.23)])
    nose=obj('face_nose')
    replace(nose,[(-.058,-.268,1.88),(.058,-.268,1.88),(-.058,-.391,1.855),(.058,-.391,1.855),(-.068,-.268,1.665),(.068,-.268,1.665),(-.068,-.413,1.68),(.068,-.413,1.68)],[(0,1,3,2),(4,6,7,5),(0,2,6,4),(1,5,7,3),(2,3,7,6),(0,4,5,1)])
    for s,sign in [('L',1),('R',-1)]:
        ear=obj('ear_'+s); loft(ear,[(1.655,.09,.13,0,.18),(1.69,.11,.17,0,.13),(1.815,.11,.17,0,.13),(1.85,.075,.125,0,.15)])
        inset=material('ear_inset_'+s,'#996846')
        cube('ear_inset_'+s,(sign*.389,-.066,1.755),(.031,.022,.075),inset,'head',bevel=.004)
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH': continue
        n=o.name; x,y,z=o.location; w,d,h=o.dimensions
        if n.startswith(('body_upper_arm','body_forearm','body_hand','trousers_','shoe_','outfit_lower','outfit_upper')):
            loft(o,[(z-h/2,w*.86,d*.88,y,.16),(z-h*.34,w,d,y,.14),(z+h*.34,w,d,y,.14),(z+h/2,w*.9,d*.9,y,.17)])
        if n.startswith('outfit_sleeve'):
            loft(o,[(1.135,.20,.245,0,.17),(1.265,.24,.30,0,.17),(1.325,.215,.28,0,.19),(1.38,.12,.22,0,.2)])
    for n in ['body_torso','outfit_torso']:
        o=obj(n); extra=.014 if n.startswith('outfit') else 0
        loft(o,[(.95,.49+extra,.32+extra,0,.13),(1.15,.57+extra,.365+extra,0,.13),(1.29,.63+extra,.37+extra,0,.13),(1.365,.62+extra,.32+extra,0,.18),(1.4,.30+extra,.285+extra,0,.2)])
    # Shape the hair as a cap with sloping overlapping locks, rather than flat Lego steps.
    if v['hair'] in ['crop','sidepart']:
        loft(obj('hair_crown'),[(1.99,.67,.55,.015,.13),(2.10,.69,.57,.015,.14),(2.17,.59,.49,.04,.18)])
        for o in list(bpy.context.scene.objects):
            if o.name.startswith('hair_lock'):
                i=int(o.name.split('_')[-1]); o.rotation_euler[1]=-.14 if v['hair']=='sidepart' else -.08
                o.rotation_euler[0]=-.13; o.location.z-=.015
            if o.name.startswith('hair_temple'):
                o.dimensions.z=.24; o.location.z=1.98
        # Additional swept temple locks define the silhouette.
        for sign in [-1,1]:
            for j in range(3):
                o=cube('hair_swept',(sign*.316,.16-j*.095,2.06-j*.035),(.085,.16,.13),hair,'head','hair',bevel=.008)
                o.rotation_euler[0]=-.25
    if v['hair']=='mohawk':
        for o in list(bpy.context.scene.objects):
            if o.name.startswith('mohawk'):
                i=int(o.name.split('_')[-1]); o.rotation_euler[0]=-.24+i*.035; o.dimensions.x=.17
    if v['hat']=='beanie':
        loft(obj('beanie_cuff'),[(1.955,.69,.56,0,.16),(2.09,.74,.60,0,.14)])
        loft(obj('beanie_crown'),[(2.075,.70,.57,.015,.15),(2.19,.64,.54,.035,.17),(2.25,.49,.44,.04,.2)])
        loft(obj('beanie_top'),[(2.235,.50,.44,.04,.18),(2.27,.35,.31,.04,.22)])
        for o in list(bpy.context.scene.objects):
            if o.name.startswith('beanie_rib'): o.location.z=2.025; o.dimensions.z=.13
    if v['hat']=='cap':
        loft(obj('cap_crown'),[(2.02,.73,.59,.01,.12),(2.16,.71,.57,.01,.13),(2.21,.57,.47,.02,.16)])
        brim=obj('cap_brim'); loft(brim,[(2.002,.75,.33,-.365,.11),(2.04,.75,.33,-.365,.11)])
    # Tailored collars and lapels are extruded polygons, with visible cloth thickness.
    def panel(name,points,mat):
        o=cube(name,(0,0,0),(.01,.01,.01),mat,'spine','outfit')
        verts=[(x,y,z) for x,y,z in points]+[(x,y+.018,z) for x,y,z in points]; n=len(points)
        return replace(o,verts,[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    if v['outfit'] in ['shirt','workshirt','jacket']:
        remove('collar')
        for sign in [-1,1]:
            panel('tailored_collar',[(sign*.04,-.173,1.402),(sign*.15,-.157,1.388),(sign*.222,-.204,1.284),(sign*.102,-.218,1.325)],cloth)
            if v['outfit']=='jacket':
                panel('jacket_lapel',[(sign*.15,-.18,1.382),(sign*.266,-.195,1.315),(sign*.108,-.211,1.123),(sign*.084,-.205,1.306)],cloth)
        if v['id']=='04-punk':
            steel=material('jacket_studs','#939A9E')
            for sign in [-1,1]:
                for j in range(3): cube('shoulder_stud',(sign*(.26+j*.045),-.065,1.37-j*.015),(.027,.035,.025),steel,'upper_arm.L' if sign>0 else 'upper_arm.R','outfit',bevel=.004)
    if v['outfit']=='tee':
        bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=4,location=(0,0,1.40),major_radius=.166,minor_radius=.018)
        o=bpy.context.object; o.name='crew_neck'; o.scale.y=.90
        o.data.materials.append(cloth); o['trait_slot']='outfit'; o.parent=rig
        g=o.vertex_groups.new(name='spine'); g.add(list(range(len(o.data.vertices))),1,'REPLACE')
        m=o.modifiers.new('rig','ARMATURE'); m.object=rig
    if v['outfit']=='hoodie':
        loft(obj('hood_back'),[(1.25,.40,.13,.21,.15),(1.41,.43,.16,.21,.16),(1.45,.32,.12,.19,.2)])
        for o in list(bpy.context.scene.objects):
            if o.name.startswith('hood_side'): o.rotation_euler[1]=.22 if o.location.x>0 else -.22
    if v['face']=='beard':
        loft(obj('beard_chin'),[(1.41,.36,.14,-.235,.2),(1.47,.52,.16,-.245,.13),(1.54,.55,.16,-.24,.13)])
    # Faceted edge treatment on remaining thin details, preserving angular identity.
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.name.startswith(('brow','hair_lock','mustache','beard_side','beard_lower')):
            m=o.modifiers.new('Detail bevel','BEVEL'); m.width=.007; m.segments=1
            bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=m.name)
    # The concept has a longer face, not a cubic toy head. Transform all head traits together.
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        if o.type=='MESH' and o.vertex_groups and o.vertex_groups[0].name=='head' and o.name!='body_neck':
            world=o.matrix_world.copy(); inv=world.inverted()
            for vertex in o.data.vertices:
                p=world @ vertex.co; p.x*=.92; p.z=1.44+(p.z-1.44)*1.20
                vertex.co=inv @ p
