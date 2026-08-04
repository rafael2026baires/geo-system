"""Generate the isolated low-poly logistics truck used for GeoSystem review."""

from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = (
    PROJECT_ROOT
    / "public"
    / "assets"
    / "models"
    / "3d"
    / "truck_logistics_v1.glb"
)


def create_material(name, color, roughness=0.88):
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = roughness
    return material


def apply_bevel(obj, width, segments):
    bevel = obj.modifiers.new(name="Structural bevel", type="BEVEL")
    bevel.width = width
    bevel.segments = segments
    bevel.affect = "EDGES"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)


def add_box(name, location, dimensions, material, bevel=0.0, segments=1):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        apply_bevel(obj, bevel, segments)
    return obj


def add_cabin(material):
    # Blender coordinates: +X front, +Z up, Y width.
    vertices = [
        (1.20, -1.08, 0.48),
        (3.45, -1.08, 0.48),
        (3.45, -1.08, 2.22),
        (2.82, -1.08, 3.02),
        (1.20, -1.08, 3.02),
        (1.20, 1.08, 0.48),
        (3.45, 1.08, 0.48),
        (3.45, 1.08, 2.22),
        (2.82, 1.08, 3.02),
        (1.20, 1.08, 3.02),
    ]
    faces = [
        (0, 1, 2, 3, 4),
        (9, 8, 7, 6, 5),
        (0, 5, 6, 1),
        (1, 6, 7, 2),
        (2, 7, 8, 3),
        (3, 8, 9, 4),
        (4, 9, 5, 0),
    ]
    mesh = bpy.data.meshes.new("CabinGeometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new("Cabin", mesh)
    bpy.context.collection.objects.link(obj)
    apply_bevel(obj, 0.075, 2)
    return obj


def add_wheel(name, x, side, material):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=0.52,
        depth=0.28,
        end_fill_type="NGON",
        location=(x, side * 1.18, 0.52),
        rotation=(1.5707963267948966, 0.0, 0.0),
    )
    wheel = bpy.context.object
    wheel.name = name
    wheel.data.materials.append(material)
    apply_bevel(wheel, 0.065, 1)
    return wheel


def add_glass(material):
    windshield = add_box(
        "Windshield",
        location=(3.17, 0.0, 2.49),
        dimensions=(0.055, 1.78, 0.72),
        material=material,
        bevel=0.035,
        segments=1,
    )
    windshield.rotation_euler[1] = -0.665
    bpy.context.view_layer.objects.active = windshield
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return windshield


def triangulate_and_join(objects, materials):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    truck = bpy.context.object
    truck.name = "TruckLogisticsV1"

    # Normalize material slot order and remove unused duplicate slots after join.
    for material in materials:
        if truck.data.materials.get(material.name) is None:
            truck.data.materials.append(material)

    triangulate = truck.modifiers.new(name="Export triangulation", type="TRIANGULATE")
    triangulate.quad_method = "BEAUTY"
    triangulate.ngon_method = "BEAUTY"
    bpy.context.view_layer.objects.active = truck
    bpy.ops.object.modifier_apply(modifier=triangulate.name)

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    truck.data.update()
    truck.data.calc_loop_triangles()
    return truck


def center_on_ground(truck):
    vertices = [vertex.co for vertex in truck.data.vertices]
    minimum = Vector((
        min(vertex.x for vertex in vertices),
        min(vertex.y for vertex in vertices),
        min(vertex.z for vertex in vertices),
    ))
    maximum = Vector((
        max(vertex.x for vertex in vertices),
        max(vertex.y for vertex in vertices),
        max(vertex.z for vertex in vertices),
    ))
    offset = Vector((
        -0.5 * (minimum.x + maximum.x),
        -0.5 * (minimum.y + maximum.y),
        -minimum.z,
    ))
    for vertex in truck.data.vertices:
        vertex.co += offset
    truck.data.update()
    truck.data.calc_loop_triangles()


def validate_scene(truck):
    points = [
        truck.matrix_world @ vertex.co
        for vertex in truck.data.vertices
    ]
    minimum = Vector((
        min(point.x for point in points),
        min(point.y for point in points),
        min(point.z for point in points),
    ))
    maximum = Vector((
        max(point.x for point in points),
        max(point.y for point in points),
        max(point.z for point in points),
    ))
    triangle_count = len(truck.data.loop_triangles)
    material_names = [material.name for material in truck.data.materials]

    if not 850 <= triangle_count <= 1200:
        raise RuntimeError(
            f"Triangle count outside required range: {triangle_count}"
        )
    if set(material_names) != {"body", "cabin", "wheel", "glass"}:
        raise RuntimeError(f"Unexpected materials: {material_names}")
    if abs(minimum.z) > 1e-5:
        raise RuntimeError(f"Wheels are not grounded: min Z={minimum.z}")
    if abs((minimum.x + maximum.x) * 0.5) > 1e-5:
        raise RuntimeError("Longitudinal origin is not centered")
    if abs((minimum.y + maximum.y) * 0.5) > 1e-5:
        raise RuntimeError("Lateral origin is not centered")

    print(
        "TRUCK_METRICS",
        {
            "triangles": triangle_count,
            "materials": material_names,
            "blender_bounds_min": tuple(round(value, 6) for value in minimum),
            "blender_bounds_max": tuple(round(value, 6) for value in maximum),
        },
    )


def main():
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

    body = create_material("body", (0.22, 0.29, 0.34), 0.9)
    cabin = create_material("cabin", (0.38, 0.45, 0.49), 0.87)
    wheel = create_material("wheel", (0.025, 0.03, 0.035), 0.94)
    glass = create_material("glass", (0.07, 0.11, 0.14), 0.82)
    materials = [body, cabin, wheel, glass]

    objects = [
        add_box(
            "CargoBox",
            location=(-1.40, 0.0, 1.87),
            dimensions=(4.80, 2.34, 2.92),
            material=body,
            bevel=0.075,
            segments=2,
        ),
        add_box(
            "LowerChassis",
            location=(0.0, 0.0, 0.27),
            dimensions=(6.90, 1.72, 0.28),
            material=body,
            bevel=0.055,
            segments=2,
        ),
        add_box(
            "FrontBumper",
            location=(3.52, 0.0, 0.72),
            dimensions=(0.18, 2.18, 0.30),
            material=body,
            bevel=0.045,
            segments=2,
        ),
        add_cabin(cabin),
        add_glass(glass),
    ]
    for axle_name, axle_x in (("Rear", -2.35), ("Front", 2.25)):
        for side_name, side in (("Left", -1), ("Right", 1)):
            objects.append(
                add_wheel(
                    f"{axle_name}Wheel{side_name}",
                    axle_x,
                    side,
                    wheel,
                )
            )

    truck = triangulate_and_join(objects, materials)
    center_on_ground(truck)
    validate_scene(truck)

    bpy.ops.object.select_all(action="DESELECT")
    truck.select_set(True)
    bpy.context.view_layer.objects.active = truck
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
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
    )
    print(f"TRUCK_OUTPUT {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
