"""Render the three tiles in Blender (headless). Pattern maps come from make_maps.py.
Run: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P design/blender/render_tiles.py -- [samples]
Output: design/blender/renders/<name>.png, exactly one tile each (a repeating pattern, centre of a 3 x 3 plane).
"""
import os
import sys
import bpy
from mathutils import Euler
from math import radians

HERE = os.path.dirname(os.path.abspath(__file__))
MAPS, OUT = os.path.join(HERE, "maps"), os.path.join(HERE, "renders")
os.makedirs(OUT, exist_ok=True)
samples = int(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv and len(sys.argv) > sys.argv.index("--") + 1 else 48

# name: (tile px w, h, metallic, roughness, bump strength, bump distance, coat, sun angles, sun energy, sky strength)
SPECS = {
    "grass": (512, 512, 0.0, 0.88, 0.9, 0.012, 0.0, (58, 0, 35), 3.0, 0.7),
    "steel": (512, 256, 0.92, 0.36, 1.2, 0.02, 0.0, (52, 0, 20), 4.0, 0.75),
    "seats": (512, 512, 0.0, 0.40, 1.2, 0.03, 0.12, (50, 0, 28), 3.2, 0.30),
}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def image(path, data):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = "sRGB" if data == "colour" else "Non-Color"
    return img


def build(name):
    w, h, metal, rough, bump_s, bump_d, coat, sun, energy, sky = SPECS[name]
    aspect = w / h
    clear()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = os.path.join(OUT, f"{name}.png")

    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.object
    plane.scale = (3 * aspect, 3, 1)               # 3 x 3 tiles; the camera sees only the middle one

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (3, 3, 3)
    col = nt.nodes.new("ShaderNodeTexImage"); col.image = image(os.path.join(MAPS, f"{name}_colour.png"), "colour"); col.extension = "REPEAT"
    hgt = nt.nodes.new("ShaderNodeTexImage"); hgt.image = image(os.path.join(MAPS, f"{name}_height.png"), "data"); hgt.extension = "REPEAT"
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_s
    bump.inputs["Distance"].default_value = bump_d
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    for t in (col, hgt):
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(hgt.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.12
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    plane.data.materials.append(mat)

    cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = aspect
    cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam)
    cam.location = (0, 0, 5); scene.camera = cam

    # suns only: a sun is identical at every point, so the tile has no light gradient and repeats cleanly
    for ang, en in ((sun, energy), ((30, 0, 215), energy * 0.35)):
        ld = bpy.data.lights.new("sun", "SUN"); ld.energy = en; ld.angle = radians(24)
        lo = bpy.data.objects.new("sun", ld); lo.rotation_euler = Euler([radians(a) for a in ang]); scene.collection.objects.link(lo)
    world = bpy.data.worlds.new("w"); world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.78, 0.84, 1.0, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = sky
    scene.world = world
    bpy.ops.render.render(write_still=True)
    print("rendered", name)


for key in SPECS:
    build(key)
