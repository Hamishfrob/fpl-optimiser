"""Real mown turf: individual blades modelled in Blender, leaning one way in the light stripes and the other way in the dark ones.
The blade layout repeats exactly (blades near an edge are duplicated on the opposite side), so the tile is seamless.
Run: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P design/blender/render_grass.py -- [samples] [px]
Output: design/blender/renders/grass.png  (one tile; finish_tiles.py shrinks it to 512 px and writes web/img/grass.webp)
"""
import os
import sys
from math import radians, sin, cos, pi

import bpy
import numpy as np
from mathutils import Euler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "renders")
os.makedirs(OUT, exist_ok=True)
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(args[0]) if len(args) > 0 else 64
PX = int(args[1]) if len(args) > 1 else 1024

N = 190_000                 # blades in one tile
MARGIN = 0.06               # blades this close to an edge are copied across, so the edge matches
rng = np.random.default_rng(11)

# ---- blade layout
pos = rng.random((N, 2))                                   # base position inside the tile, 0..1
y = pos[:, 1]
# stripe: whole cycles in y. +1 in the first half (blades lean away), -1 in the second (lean towards)
soft = np.tanh(40.0 * np.sin(2 * pi * (y + 0.25)))   # stripe edges at y = 0.25 and 0.75, so the tile's own edge sits inside a stripe                  # smooth switch near the stripe edges
lean_dir = np.where(rng.random(N) < 0.5 + 0.5 * soft, 1.0, -1.0)  # blades near an edge choose either way
length = rng.uniform(0.017, 0.028, N)
lean = np.radians(rng.uniform(30, 50, N))                  # angle from vertical at the tip
az_jit = np.radians(rng.normal(0, 18, N))                  # sideways wobble
width = rng.uniform(0.0028, 0.0042, N)
twist = rng.uniform(0, pi, N)                              # which way the ribbon faces

# patchy macro lightness that also repeats (integer frequencies)
px, py = pos[:, 0], pos[:, 1]
macro = (0.5 + 0.012 * np.sin(2 * pi * (3 * px + 1 * py) + 1.3) + 0.008 * np.sin(2 * pi * (7 * px - 5 * py) + 0.4)
         + 0.006 * np.sin(2 * pi * (2 * py + 11 * px) + 2.1))
stripe_boost = 1.0 + 0.30 * soft                           # the light stripe is clearly brighter than the dark one
hue = rng.random(N)

# duplicate across edges so the tile wraps
copies = []
for ox in (-1, 0, 1):
    for oy in (-1, 0, 1):
        p = pos + np.array([ox, oy])
        keep = (p[:, 0] > -MARGIN) & (p[:, 0] < 1 + MARGIN) & (p[:, 1] > -MARGIN) & (p[:, 1] < 1 + MARGIN)
        copies.append((p, keep))
idx = np.concatenate([np.where(k)[0] for _, k in copies])
base = np.concatenate([p[k] for p, k in copies])
M = len(idx)


def pick(a):
    return a[idx]


L, th, jit, w, tw, ld = pick(length), pick(lean), pick(az_jit), pick(width), pick(twist), pick(lean_dir)

# direction of the blade tip: mostly up (z) tilted by `lean` along +-y with sideways wobble
dx = np.sin(th) * np.sin(jit)
dy = ld * np.sin(th) * np.cos(jit)
dz = np.cos(th)
d = np.stack([dx, dy, dz], 1)
# ribbon width direction: perpendicular to d, rotated around d by `tw`
a = np.stack([-d[:, 1], d[:, 0], np.zeros(M)], 1)
a /= np.linalg.norm(a, axis=1, keepdims=True) + 1e-9
b = np.cross(d, a)
wv = a * np.cos(tw)[:, None] + b * np.sin(tw)[:, None]

zero = np.zeros(M)
b0 = np.stack([base[:, 0], base[:, 1], zero], 1)
# the blade bends: lower half stands straighter, the upper half leans
mid = b0 + (np.stack([dx * 0.35, dy * 0.35, dz * 0.62 + 0 * dz], 1)) * L[:, None] * 0.55
tip = b0 + d * L[:, None]
verts = np.concatenate([b0 - wv * (w / 2)[:, None], b0 + wv * (w / 2)[:, None],
                        mid - wv * (w * 0.35)[:, None], mid + wv * (w * 0.35)[:, None], tip], 0).reshape(5, M, 3).transpose(1, 0, 2).reshape(-1, 3)

# colours (linear): dark at the base, brighter towards the tip, a little yellow-green to deep-green variation per blade
h = pick(hue)[:, None]
deep = np.array([0.035, 0.19, 0.035]); fresh = np.array([0.12, 0.46, 0.06]); yellow = np.array([0.22, 0.50, 0.06])
tipcol = deep * (1 - h) + fresh * h
tipcol = tipcol * (1 - 0.35 * (h > 0.82)) + yellow * 0.35 * (h > 0.82)
bright = (pick(macro) * 0.8 + 0.78)[:, None] * pick(stripe_boost)[:, None]
tipcol = tipcol * bright
basecol = tipcol * 0.34
vcol = np.stack([basecol, basecol, tipcol * 0.8, tipcol * 0.8, tipcol], 1)       # (M, 5, 3)
vcol = np.concatenate([vcol, np.ones((M, 5, 1))], 2).reshape(-1, 4)

# faces: a quad for the lower half, a triangle for the tip
v0 = np.arange(M) * 5
faces = np.concatenate([np.stack([v0, v0 + 1, v0 + 3, v0 + 2], 1).reshape(M, 4), ], 0)
tris = np.stack([v0 + 2, v0 + 3, v0 + 4], 1)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.render.resolution_x = scene.render.resolution_y = PX
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.render.filepath = os.path.join(OUT, "grass.png")

mesh = bpy.data.meshes.new("blades")
mesh.from_pydata(verts.tolist(), [], faces.tolist() + tris.tolist())
mesh.update()
attr = mesh.color_attributes.new("col", "FLOAT_COLOR", "POINT")
attr.data.foreach_set("color", vcol.flatten().tolist())
obj = bpy.data.objects.new("grass", mesh)
scene.collection.objects.link(obj)

mat = bpy.data.materials.new("blade")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputMaterial")
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "col"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.42
bsdf.inputs["Specular IOR Level"].default_value = 0.55
nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
obj.data.materials.append(mat)

# soil under the blades so no gap shows through
bpy.ops.mesh.primitive_plane_add(size=1.4, location=(0.5, 0.5, -0.0005))
soil = bpy.context.object
sm = bpy.data.materials.new("soil"); sm.use_nodes = True
sm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.11, 0.025, 1)
sm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
soil.data.materials.append(sm)

cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = 1.0
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam)
cam.location = (0.5, 0.5, 2.0); scene.camera = cam

# low sun along the stripe direction so leaning blades catch it, plus a soft fill (suns only: no gradient across the tile)
for ang, en in (((55, 0, 180), 6.5), ((40, 0, 0), 1.6)):
    ld = bpy.data.lights.new("sun", "SUN"); ld.energy = en; ld.angle = radians(14)
    lo = bpy.data.objects.new("sun", ld); lo.rotation_euler = Euler([radians(q) for q in ang]); scene.collection.objects.link(lo)
world = bpy.data.worlds.new("w"); world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.70, 0.82, 1.0, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
scene.world = world
bpy.ops.render.render(write_still=True)
print("rendered grass", PX, "px,", M, "blades")
