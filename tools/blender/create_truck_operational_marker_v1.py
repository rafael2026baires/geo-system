"""Build the isolated GeoSystem operational 3D truck marker V1."""

from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/assets/models/3d/truck_operational_marker_v1.glb"
PREVIEW_DIR = OUTPUT.parent / "preview"
MATERIAL_ORDER = ("body", "cabin", "glass", "wheel", "detail")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            blocks.remove(block)


def material(name, rgb, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1.0)
    mat.use_nodes = True
    mat.use_backface_culling = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = roughness
    return mat


def bevel(obj, width):
    if width <= 0:
        return
    mod = obj.modifiers.new("MarkerEdge", "BEVEL")
    mod.width = width
    mod.segments = 1
    mod.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, location, dimensions, mat, edge=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel(obj, edge)
    return obj


def mesh_object(name, vertices, faces, mat, edge=0.0):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bevel(obj, edge)
    return obj


def cabin_shell(mat):
    # Broad cab-over wedge; the sloped front and chamfered roof read at small scale.
    rear, nose, brow = 0.80, 4.05, 3.72
    bottom, roof_rear, roof_front = 1.30, 4.18, 4.06
    half = 1.47
    vertices = [
        (rear, -half, bottom), (nose, -half, bottom),
        (brow, -half, roof_front), (rear, -half, roof_rear),
        (rear, half, bottom), (nose, half, bottom),
        (brow, half, roof_front), (rear, half, roof_rear),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
             (3, 2, 6, 7), (1, 5, 6, 2), (0, 3, 7, 4)]
    return mesh_object("OperationalCabin", vertices, faces, mat, 0.08)


def front_glass(mat):
    return mesh_object("WideWindshield", [
        (3.94, -1.22, 2.28), (3.94, 1.22, 2.28),
        (3.76, 1.22, 3.72), (3.76, -1.22, 3.72),
    ], [(0, 1, 2, 3)], mat)


def side_glass(name, side, mat):
    y = side * 1.478
    vertices = [(1.50, y, 2.26), (3.50, y, 2.26),
                (3.37, y, 3.65), (1.50, y, 3.77)]
    return mesh_object(name, vertices, [(0, 1, 2, 3) if side < 0 else (3, 2, 1, 0)], mat)


def wheel_pair(name, x, mats):
    objects = []
    for side, label in ((-1, "L"), (1, "R")):
        y = side * 1.43
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, radius=0.76, depth=0.44, end_fill_type="NGON",
            location=(x, y, 0.76), rotation=(math.pi / 2, 0, 0),
        )
        tire = bpy.context.object
        tire.name = f"{name}Tire{label}"
        tire.data.materials.append(mats["wheel"])
        bevel(tire, 0.07)
        objects.append(tire)

        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12, radius=0.31, depth=0.46, end_fill_type="NGON",
            location=(x, y, 0.76), rotation=(math.pi / 2, 0, 0),
        )
        hub = bpy.context.object
        hub.name = f"{name}Hub{label}"
        hub.data.materials.append(mats["detail"])
        objects.append(hub)
    return objects


def mirror(name, side, mat):
    y = side * 1.69
    arm = box(f"{name}Arm", (3.18, side * 1.57, 3.10), (0.12, 0.32, 0.12), mat, 0.025)
    head = box(name, (3.18, y, 3.16), (0.28, 0.16, 0.46), mat, 0.045)
    return [arm, head]


def build(mats):
    body, cabin, glass, detail = mats["body"], mats["cabin"], mats["glass"], mats["detail"]
    out = []

    # Strong dark understructure leaves daylight around the larger wheels.
    out += [
        box("Chassis", (-0.15, 0, 0.91), (7.72, 1.78, 0.34), detail, 0.05),
        box("CargoDeck", (-1.67, 0, 1.25), (4.72, 2.62, 0.28), detail, 0.05),
        box("CabinLower", (2.38, 0, 1.44), (3.42, 3.02, 1.32), cabin, 0.12),
        cabin_shell(cabin),
        box("CabinRoof", (2.25, 0, 4.18), (2.82, 3.02, 0.16), cabin, 0.07),
        box("RoofMarkerBar", (2.32, 0, 4.31), (1.25, 0.28, 0.10), body, 0.04),
        front_glass(glass),
        side_glass("SideGlassLeft", -1, glass),
        side_glass("SideGlassRight", 1, glass),
    ]

    # Compact cargo block: 4.65 m versus 3.42 m cab, lower by about 12%.
    out += [
        box("CompactCargoBody", (-1.70, 0, 2.47), (4.64, 2.72, 2.44), body, 0.15),
        box("CargoTopCap", (-1.70, 0, 3.72), (4.40, 2.52, 0.14), body, 0.06),
        box("RearContrastPanel", (-4.055, 0, 2.44), (0.11, 2.48, 2.22), detail, 0.035),
        box("RearUpperBand", (-4.125, 0, 3.53), (0.10, 2.38, 0.18), body, 0.03),
        box("CargoRailLeft", (-1.70, -1.39, 1.39), (4.48, 0.12, 0.22), detail, 0.03),
        box("CargoRailRight", (-1.70, 1.39, 1.39), (4.48, 0.12, 0.22), detail, 0.03),
        box("CabCargoBridge", (0.69, 0, 1.43), (0.22, 1.90, 0.46), detail, 0.04),
    ]

    # Bold, sparse front details.
    out += [
        box("FrontBumper", (4.18, 0, 0.96), (0.22, 2.96, 0.34), detail, 0.045),
        box("FrontGrille", (4.20, 0, 1.55), (0.12, 1.58, 0.50), detail, 0.03),
        box("HeadlampLeft", (4.25, -1.13, 1.76), (0.10, 0.42, 0.32), body, 0.03),
        box("HeadlampRight", (4.25, 1.13, 1.76), (0.10, 0.42, 0.32), body, 0.03),
    ]
    out += mirror("MirrorLeft", -1, detail) + mirror("MirrorRight", 1, detail)

    for x, label in ((2.72, "Front"), (-2.72, "Rear")):
        out += wheel_pair(label, x, mats)
        for side, side_label in ((-1, "L"), (1, "R")):
            out.append(box(f"{label}Fender{side_label}", (x, side * 1.48, 1.40),
                           (1.78, 0.18, 0.26), detail, 0.05))
    return out


def finalize(objects, mats):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    truck = bpy.context.object
    truck.name = "GeoSystem_Operational_Truck_Marker_V1"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    old_names = [mat.name for mat in truck.data.materials]
    polygon_names = [old_names[p.material_index] for p in truck.data.polygons]
    truck.data.materials.clear()
    for name in MATERIAL_ORDER:
        truck.data.materials.append(mats[name])
    for polygon, name in zip(truck.data.polygons, polygon_names):
        polygon.material_index = MATERIAL_ORDER.index(name)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    bpy.ops.mesh.remove_doubles(threshold=0.00001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    points = [truck.matrix_world @ v.co for v in truck.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    for vertex in truck.data.vertices:
        vertex.co -= center
    truck.location = (0, 0, 0)
    truck.rotation_euler = (0, 0, 0)
    truck.scale = (1, 1, 1)
    truck.data.validate(clean_customdata=True)
    truck.data.update()
    return truck


def metrics(truck):
    truck.data.calc_loop_triangles()
    points = [truck.matrix_world @ v.co for v in truck.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return len(truck.data.vertices), len(truck.data.loop_triangles), low, high


def validate(truck, data):
    vertices, triangles, low, high = data
    if [m.name for m in truck.data.materials] != list(MATERIAL_ORDER):
        raise RuntimeError("Material slots are not canonical")
    if not 700 <= triangles < 3000:
        raise RuntimeError(f"Triangle count outside operational target: {triangles}")
    if abs(low.z) > 0.0001:
        raise RuntimeError(f"Ground support is not zero: {low.z}")
    if abs(low.x + high.x) > 0.0001 or abs(low.y + high.y) > 0.0001:
        raise RuntimeError("Origin is not centered")
    if tuple(truck.location) != (0.0, 0.0, 0.0) or tuple(truck.scale) != (1.0, 1.0, 1.0):
        raise RuntimeError("Transforms are not applied")


def export(truck):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    truck.select_set(True)
    bpy.context.view_layer.objects.active = truck
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT), export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_materials="EXPORT",
        export_cameras=False, export_lights=False, export_animations=False,
        export_skins=False, export_morph=False, export_texcoords=False,
        export_normals=True, export_tangents=False, export_attributes=False,
    )


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def previews():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 800, 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.018, 0.026, 0.038)
    ground = material("PreviewGround", (0.035, 0.050, 0.068), 0.96)
    box("PreviewGround", (0, 0, -0.08), (15, 12, 0.14), ground)

    for kind, location, energy, size in (
        ("AREA", (5.0, -5.5, 8.0), 760, 5.5),
        ("AREA", (-5.0, 4.0, 6.5), 520, 6.5),
    ):
        bpy.ops.object.light_add(type=kind, location=location)
        light = bpy.context.object
        light.data.energy, light.data.shape, light.data.size = energy, "DISK", size
        look_at(light, (0, 0, 1.7))
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
    bpy.context.object.rotation_euler = (math.radians(30), math.radians(-18), math.radians(35))
    bpy.context.object.data.energy = 1.0

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    views = {
        "render_truck_operational_marker_v1_front.png": ((9.5, -9.0, 6.5), (0.3, 0, 1.7), 58),
        "render_truck_operational_marker_v1_side.png": ((0, -13.0, 5.2), (0, 0, 1.7), 60),
        "render_truck_operational_marker_v1_rear_high.png": ((-10.0, 7.5, 10.0), (-0.4, 0, 1.5), 60),
        "render_truck_operational_marker_v1_top_high.png": ((2.5, -3.5, 15.0), (0, 0, 1.2), 62),
    }
    for filename, (location, target, lens) in views.items():
        camera.location, camera.data.lens = location, lens
        look_at(camera, target)
        scene.render.filepath = str(PREVIEW_DIR / filename)
        bpy.ops.render.render(write_still=True)
        print(f"OPERATIONAL_PREVIEW {PREVIEW_DIR / filename}")


def main():
    clear_scene()
    mats = {
        "body": material("body", (0.40, 0.48, 0.55), 0.88),
        "cabin": material("cabin", (0.64, 0.68, 0.72), 0.84),
        "glass": material("glass", (0.055, 0.105, 0.145), 0.91),
        "wheel": material("wheel", (0.020, 0.027, 0.034), 0.95),
        "detail": material("detail", (0.070, 0.090, 0.115), 0.94),
    }
    source_objects = build(mats)
    truck = finalize(source_objects, mats)
    data = metrics(truck)
    validate(truck, data)
    export(truck)
    previews()
    vertices, triangles, low, high = data
    print(f"OPERATIONAL_OUTPUT {OUTPUT}")
    print(f"OPERATIONAL_SOURCE_OBJECTS {len(source_objects)}")
    print("OPERATIONAL_FRONT_GLTF +X")
    print("OPERATIONAL_UP_GLTF +Y")
    print("OPERATIONAL_METRICS", {
        "vertices": vertices, "triangles": triangles,
        "min": tuple(round(v, 5) for v in low),
        "max": tuple(round(v, 5) for v in high),
        "dimensions": tuple(round(v, 5) for v in high - low),
        "materials": list(MATERIAL_ORDER),
    })


if __name__ == "__main__":
    main()
