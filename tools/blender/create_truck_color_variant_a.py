"""Generate isolated material-only color variants of the existing truck."""

from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/assets/models/3d/low_poly_truck_smooth_box_cabin_box_test_v1.glb"
PREVIEW_DIR = ROOT / "public/assets/models/3d/preview"
SOURCE_TO_TARGET = {
    "body": "box",
    "black": "details",
    "cabin": "cabin",
    "glass": "glass",
    "wheel": "wheels",
    "haedlights": "lights",
}

VARIANT_A = {
    "box": ((0.60, 0.64, 0.68), 0.88),
    "cabin": ((0.34, 0.42, 0.49), 0.87),
    "glass": ((0.055, 0.095, 0.135), 0.91),
    "wheels": ((0.022, 0.028, 0.035), 0.92),
    "details": ((0.060, 0.078, 0.098), 0.92),
    "lights": ((0.72, 0.75, 0.76), 0.86),
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
    ):
        for block in list(blocks):
            blocks.remove(block)


def make_material(name, rgb, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1.0)
    mat.use_nodes = True
    mat.use_backface_culling = False
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = roughness
    return mat


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def snapshot_geometry(objects):
    snapshot = {}
    for obj in objects:
        obj.data.calc_loop_triangles()
        snapshot[obj.name] = {
            "vertices": [tuple(round(value, 7) for value in vertex.co) for vertex in obj.data.vertices],
            "triangles": [tuple(triangle.vertices) for triangle in obj.data.loop_triangles],
            "matrix": tuple(round(value, 7) for row in obj.matrix_world for value in row),
        }
    return snapshot


def scene_bounds(objects):
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return low, high


def recolor(objects, palette):
    created = {
        name: make_material(name, rgb, roughness)
        for name, (rgb, roughness) in palette.items()
    }
    assigned = set()
    for obj in objects:
        if len(obj.data.materials) != 1:
            raise RuntimeError(f"Expected one material on {obj.name}")
        source_name = obj.data.materials[0].name
        target_name = SOURCE_TO_TARGET.get(source_name)
        if not target_name:
            raise RuntimeError(f"Unexpected source material: {source_name}")
        obj.data.materials.clear()
        obj.data.materials.append(created[target_name])
        assigned.add(target_name)
    if assigned != set(palette):
        raise RuntimeError(f"Incomplete material assignment: {assigned}")
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    for name, mat in created.items():
        mat.name = name


def export_glb(objects, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
    )


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def preview_material(name, rgb, roughness):
    return make_material(name, rgb, roughness)


def render_previews(variant):
    scene = bpy.context.scene
    low, high = scene_bounds(mesh_objects())
    size = high - low
    center = (low + high) * 0.5
    target = (center.x, center.y, low.z + size.z * 0.46)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.018, 0.026, 0.038)

    ground_mat = preview_material("PreviewGround", (0.035, 0.050, 0.068), 0.96)
    bpy.ops.mesh.primitive_cube_add(location=(center.x, center.y, low.z - size.z * 0.015))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.dimensions = (size.x * 2.2, size.y * 3.2, size.z * 0.025)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ground.data.materials.append(ground_mat)

    lights = (
        ((high.x + size.x * 0.35, low.y - size.y, high.z + size.z * 0.45), 1150, size.x * 0.32),
        ((low.x - size.x * 0.25, high.y + size.y, high.z + size.z * 0.25), 700, size.x * 0.38),
    )
    for location, energy, light_size in lights:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = light_size
        look_at(light, target)
    bpy.ops.object.light_add(type="SUN", location=(center.x, center.y, high.z + size.z))
    bpy.context.object.rotation_euler = (math.radians(30), math.radians(-18), math.radians(35))
    bpy.context.object.data.energy = 1.0

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    views = {
        "front": ((high.x + size.x * 0.72, low.y - size.y * 1.25, low.z + size.z * 0.82), target, 58),
        "side": ((center.x, low.y - size.y * 3.45, low.z + size.z * 0.62), target, 58),
        "rear_high": ((low.x - size.x * 0.88, high.y + size.y * 1.45, high.z + size.z * 0.58), target, 56),
    }
    for view, (location, target, lens) in views.items():
        camera.location = location
        camera.data.lens = lens
        look_at(camera, target)
        filename = f"render_truck_color_variant_{variant}_{view}.png"
        scene.render.filepath = str(PREVIEW_DIR / filename)
        bpy.ops.render.render(write_still=True)
        print(f"COLOR_VARIANT_PREVIEW {PREVIEW_DIR / filename}")


def generate_variant(variant, palette):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objects = mesh_objects()
    if len(objects) != 6:
        raise RuntimeError(f"Expected 6 source meshes, found {len(objects)}")

    geometry_before = snapshot_geometry(objects)
    bounds_before = scene_bounds(objects)
    recolor(objects, palette)
    geometry_after = snapshot_geometry(objects)
    bounds_after = scene_bounds(objects)
    if geometry_before != geometry_after:
        raise RuntimeError("Geometry changed during material replacement")
    for before, after in zip(bounds_before, bounds_after):
        if (before - after).length > 0.000001:
            raise RuntimeError("Bounds changed during material replacement")

    output = ROOT / f"public/assets/models/3d/low_poly_truck_variant_{variant}.glb"
    export_glb(objects, output)
    render_previews(variant)

    triangle_count = sum(len(obj.data.loop_triangles) for obj in objects)
    print(f"COLOR_VARIANT_OUTPUT {output}")
    print(f"COLOR_VARIANT_ID {variant}")
    print(f"COLOR_VARIANT_MESHES {len(objects)}")
    print(f"COLOR_VARIANT_TRIANGLES {triangle_count}")
    print("COLOR_VARIANT_BOUNDS", tuple(round(v, 6) for v in bounds_after[0]), tuple(round(v, 6) for v in bounds_after[1]))
    print("COLOR_VARIANT_MATERIALS", {name: values for name, values in palette.items()})


if __name__ == "__main__":
    generate_variant("a", VARIANT_A)
