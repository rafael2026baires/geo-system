"""Create the isolated GeoSystem low-poly visual truck V1."""

from pathlib import Path
import math

import bpy
from mathutils import Vector


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
OUTPUT_PATH = (
    PROJECT_ROOT
    / "public"
    / "assets"
    / "models"
    / "3d"
    / "truck_visual_v1.glb"
)
PREVIEW_DIR = OUTPUT_PATH.parent / "preview"
EXPECTED_MATERIALS = {"body", "cabin", "glass", "wheel", "detail"}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def make_material(name, color, roughness):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    material.use_backface_culling = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = roughness
    return material


def apply_bevel(obj, width, segments=1):
    if width <= 0:
        return
    modifier = obj.modifiers.new(name="TechnicalEdge", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_box(name, location, dimensions, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    apply_bevel(obj, bevel)
    return obj


def add_custom_mesh(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_cabin_upper(material):
    # Cab-over volume with a slightly inclined, faceted front.
    rear_x = 1.62
    front_lower_x = 4.42
    front_upper_x = 4.12
    z_bottom = 1.58
    rear_roof_z = 3.72
    front_roof_z = 3.60
    half_width = 1.16
    vertices = [
        (rear_x, -half_width, z_bottom),
        (front_lower_x, -half_width, z_bottom),
        (front_upper_x, -half_width, front_roof_z),
        (rear_x, -half_width, rear_roof_z),
        (rear_x, half_width, z_bottom),
        (front_lower_x, half_width, z_bottom),
        (front_upper_x, half_width, front_roof_z),
        (rear_x, half_width, rear_roof_z),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (3, 2, 6, 7),
        (1, 5, 6, 2),
        (0, 3, 7, 4),
    ]
    obj = add_custom_mesh("CabinUpper", vertices, faces, material)
    apply_bevel(obj, 0.055)
    return obj


def add_front_windshield(material):
    # Slightly offset from the inclined cabin plane to remain readable.
    half_width = 0.97
    z_low = 2.14
    z_high = 3.38
    x_low = 4.345
    x_high = 4.16
    vertices = [
        (x_low, -half_width, z_low),
        (x_low, half_width, z_low),
        (x_high, half_width, z_high),
        (x_high, -half_width, z_high),
    ]
    return add_custom_mesh(
        "FrontWindshield",
        vertices,
        [(0, 1, 2, 3)],
        material,
    )


def add_side_window(name, side, material):
    y = side * 1.166
    vertices = [
        (2.30, y, 2.12),
        (3.96, y, 2.12),
        (3.78, y, 3.34),
        (2.30, y, 3.43),
    ]
    face = (0, 1, 2, 3) if side < 0 else (3, 2, 1, 0)
    return add_custom_mesh(name, vertices, [face], material)


def add_wheel(name, x, side, wheel_material, detail_material):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=14,
        radius=0.61,
        depth=0.36,
        end_fill_type="NGON",
        location=(x, side * 1.18, 0.61),
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    wheel = bpy.context.object
    wheel.name = name
    wheel.data.materials.append(wheel_material)
    apply_bevel(wheel, 0.055)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10,
        radius=0.25,
        depth=0.375,
        end_fill_type="NGON",
        location=(x, side * 1.18, 0.61),
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    hub = bpy.context.object
    hub.name = f"{name}Hub"
    hub.data.materials.append(detail_material)
    return [wheel, hub]


def build_truck(materials):
    body = materials["body"]
    cabin = materials["cabin"]
    glass = materials["glass"]
    wheel = materials["wheel"]
    detail = materials["detail"]
    objects = []

    # Low, visible structural line ties wheels and volumes together.
    objects.append(add_box("Chassis", (-0.05, 0, 0.79), (8.70, 1.72, 0.32), detail, 0.045))
    objects.append(add_box("CargoFloor", (-1.45, 0, 1.05), (5.92, 2.30, 0.26), detail, 0.04))

    # Cargo body: long but lower than the cabin, with defined roof and rails.
    objects.append(add_box("CargoBody", (-1.48, 0, 2.25), (5.72, 2.34, 2.36), body, 0.115))
    objects.append(add_box("CargoRoof", (-1.48, 0, 3.47), (5.56, 2.24, 0.12), body, 0.045))
    objects.append(add_box("CargoRearFrame", (-4.39, 0, 2.22), (0.10, 2.18, 2.20), detail, 0.025))
    objects.append(add_box("CargoLowerRailLeft", (-1.48, -1.19, 1.26), (5.64, 0.09, 0.17), detail, 0.02))
    objects.append(add_box("CargoLowerRailRight", (-1.48, 1.19, 1.26), (5.64, 0.09, 0.17), detail, 0.02))

    # Cab has a wider, taller silhouette and a clear gap from the cargo box.
    objects.append(add_box("CabinLower", (3.05, 0, 1.18), (2.88, 2.42, 1.18), cabin, 0.10))
    objects.append(add_cabin_upper(cabin))
    objects.append(add_box("CabinRoof", (2.84, 0, 3.72), (2.42, 2.38, 0.13), cabin, 0.055))
    objects.append(add_front_windshield(glass))
    objects.append(add_side_window("SideWindowLeft", -1, glass))
    objects.append(add_side_window("SideWindowRight", 1, glass))

    # Broad front features remain legible at dashboard scale.
    objects.append(add_box("FrontBumper", (4.51, 0, 0.84), (0.18, 2.40, 0.31), detail, 0.035))
    objects.append(add_box("FrontGrille", (4.515, 0, 1.39), (0.10, 1.36, 0.43), detail, 0.02))
    objects.append(add_box("HeadlightLeft", (4.57, -0.91, 1.57), (0.08, 0.34, 0.27), body, 0.025))
    objects.append(add_box("HeadlightRight", (4.57, 0.91, 1.57), (0.08, 0.34, 0.27), body, 0.025))
    objects.append(add_box("CabCargoGap", (1.48, 0, 1.24), (0.20, 1.78, 0.42), detail, 0.025))

    # Simple upper fender brows integrate the wheels into the body line.
    for x, axle_name in ((2.95, "Front"), (-2.86, "Rear")):
        for side, side_name in ((-1, "Left"), (1, "Right")):
            objects.extend(add_wheel(f"{axle_name}Wheel{side_name}", x, side, wheel, detail))
            objects.append(add_box(
                f"{axle_name}Fender{side_name}",
                (x, side * 1.20, 1.20),
                (1.48, 0.16, 0.22),
                detail,
                0.04,
            ))

    return objects


def join_and_finalize(objects, materials):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    truck = bpy.context.object
    truck.name = "GeoSystem_Truck_Visual_V1"

    # Canonical material slot order for future isolated edits.
    material_names = [material.name for material in truck.data.materials]
    polygon_material_names = [
        material_names[polygon.material_index]
        for polygon in truck.data.polygons
    ]
    truck.data.materials.clear()
    canonical_names = ("body", "cabin", "glass", "wheel", "detail")
    for name in canonical_names:
        truck.data.materials.append(materials[name])
    for polygon, material_name in zip(truck.data.polygons, polygon_material_names):
        polygon.material_index = canonical_names.index(material_name)

    bpy.context.view_layer.objects.active = truck
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    bpy.ops.mesh.remove_doubles(threshold=0.00001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    points = [truck.matrix_world @ vertex.co for vertex in truck.data.vertices]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    center = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
    for vertex in truck.data.vertices:
        vertex.co -= center
    truck.location = (0, 0, 0)
    truck.rotation_euler = (0, 0, 0)
    truck.scale = (1, 1, 1)
    truck.data.validate(clean_customdata=True)
    truck.data.update()
    return truck


def mesh_metrics(truck):
    truck.data.calc_loop_triangles()
    points = [truck.matrix_world @ vertex.co for vertex in truck.data.vertices]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return {
        "vertices": len(truck.data.vertices),
        "triangles": len(truck.data.loop_triangles),
        "minimum": minimum,
        "maximum": maximum,
        "dimensions": maximum - minimum,
        "materials": [material.name for material in truck.data.materials],
    }


def validate(truck, metrics):
    if set(metrics["materials"]) != EXPECTED_MATERIALS:
        raise RuntimeError(f"Unexpected materials: {metrics['materials']}")
    if not 450 <= metrics["triangles"] <= 1500:
        raise RuntimeError(f"Triangle count outside lightweight range: {metrics['triangles']}")
    if abs(metrics["minimum"].z) > 0.0001:
        raise RuntimeError(f"Truck is not grounded: {metrics['minimum'].z}")
    if abs((metrics["minimum"].x + metrics["maximum"].x) * 0.5) > 0.0001:
        raise RuntimeError("Longitudinal origin is not centered")
    if abs((metrics["minimum"].y + metrics["maximum"].y) * 0.5) > 0.0001:
        raise RuntimeError("Lateral origin is not centered")
    if tuple(round(value, 6) for value in truck.scale) != (1.0, 1.0, 1.0):
        raise RuntimeError(f"Scale not applied: {tuple(truck.scale)}")


def export_glb(truck):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    truck.select_set(True)
    bpy.context.view_layer.objects.active = truck
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_PATH),
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
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_previews(truck):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.018, 0.026, 0.038)

    preview_ground = make_material("PreviewGround", (0.035, 0.050, 0.068), 0.96)
    add_box("PreviewGround", (0, 0, -0.08), (16, 12, 0.14), preview_ground)

    bpy.ops.object.light_add(type="AREA", location=(5.5, -6.0, 8.0))
    key = bpy.context.object
    key.data.energy = 850
    key.data.shape = "DISK"
    key.data.size = 5.0
    look_at(key, (0, 0, 1.5))

    bpy.ops.object.light_add(type="AREA", location=(-5.0, 4.0, 6.0))
    fill = bpy.context.object
    fill.data.energy = 600
    fill.data.size = 6.0
    look_at(fill, (0, 0, 1.7))

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
    sun = bpy.context.object
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(35))
    sun.data.energy = 1.2
    sun.data.angle = math.radians(20)

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    views = {
        "render_truck_visual_v1_front.png": ((10.5, -9.5, 6.5), (0.4, 0, 1.55), 58),
        "render_truck_visual_v1_rear_high.png": ((-11.0, 8.2, 10.0), (-0.5, 0, 1.35), 60),
        "render_truck_visual_v1_side.png": ((0.0, -14.0, 4.8), (0, 0, 1.45), 62),
    }
    for filename, (location, target, lens) in views.items():
        camera.location = location
        camera.data.lens = lens
        look_at(camera, target)
        scene.render.filepath = str(PREVIEW_DIR / filename)
        bpy.ops.render.render(write_still=True)
        print(f"TRUCK_VISUAL_PREVIEW {PREVIEW_DIR / filename}")


def main():
    clear_scene()
    materials = {
        "body": make_material("body", (0.43, 0.49, 0.54), 0.88),
        "cabin": make_material("cabin", (0.60, 0.64, 0.68), 0.86),
        "glass": make_material("glass", (0.075, 0.12, 0.16), 0.92),
        "wheel": make_material("wheel", (0.025, 0.032, 0.040), 0.96),
        "detail": make_material("detail", (0.075, 0.095, 0.12), 0.94),
    }
    truck = join_and_finalize(build_truck(materials), materials)
    metrics = mesh_metrics(truck)
    validate(truck, metrics)
    export_glb(truck)
    render_previews(truck)

    print(f"TRUCK_VISUAL_OUTPUT {OUTPUT_PATH}")
    print("TRUCK_VISUAL_FRONT_GLTF +X")
    print("TRUCK_VISUAL_UP_GLTF +Y")
    print(
        "TRUCK_VISUAL_METRICS "
        f"vertices={metrics['vertices']} "
        f"triangles={metrics['triangles']} "
        f"materials={metrics['materials']} "
        f"min={tuple(round(v, 5) for v in metrics['minimum'])} "
        f"max={tuple(round(v, 5) for v in metrics['maximum'])} "
        f"dimensions={tuple(round(v, 5) for v in metrics['dimensions'])}"
    )


if __name__ == "__main__":
    main()
