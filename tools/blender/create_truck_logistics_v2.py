"""Generate the isolated GeoSystem logistics truck visual test V2."""

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
    / "truck_logistics_v2.glb"
)
EXPECTED_MATERIALS = {"body", "cabin", "wheel", "glass", "detail"}


def create_material(name, color, roughness):
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = roughness
    return material


def apply_bevel(obj, width, segments):
    modifier = obj.modifiers.new(name="Structural bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.affect = "EDGES"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_box(name, location, dimensions, material, bevel=0.0, segments=1):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        apply_bevel(obj, bevel, segments)
    return obj


def add_cabin(material):
    # Blender coordinates: +X front, +Z up, Y width.
    side_profile = [
        (1.40, 0.52),
        (3.72, 0.52),
        (3.72, 1.62),
        (3.48, 2.10),
        (2.76, 2.82),
        (1.40, 2.82),
    ]
    vertices = [
        (x, side, z)
        for side in (-1.10, 1.10)
        for x, z in side_profile
    ]
    faces = [
        tuple(range(6)),
        tuple(range(11, 5, -1)),
        (0, 6, 7, 1),
        (1, 7, 8, 2),
        (2, 8, 9, 3),
        (3, 9, 10, 4),
        (4, 10, 11, 5),
        (5, 11, 6, 0),
    ]
    mesh = bpy.data.meshes.new("CabinV2Geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new("CabinV2", mesh)
    bpy.context.collection.objects.link(obj)
    apply_bevel(obj, 0.065, 2)
    return obj


def add_wheel(name, x, side, material):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=0.60,
        depth=0.32,
        end_fill_type="NGON",
        location=(x, side * 1.22, 0.60),
        rotation=(1.5707963267948966, 0.0, 0.0),
    )
    wheel = bpy.context.object
    wheel.name = name
    wheel.data.materials.append(material)
    apply_bevel(wheel, 0.075, 1)
    return wheel


def add_windshield(material):
    windshield = add_box(
        "LargeWindshield",
        location=(3.34, 0.0, 2.30),
        dimensions=(0.07, 1.90, 0.92),
        material=material,
        bevel=0.035,
        segments=1,
    )
    windshield.rotation_euler[1] = -0.78
    bpy.context.view_layer.objects.active = windshield
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return windshield


def join_and_triangulate(objects, materials):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    truck = bpy.context.object
    truck.name = "TruckLogisticsV2"

    for material in materials:
        if truck.data.materials.get(material.name) is None:
            truck.data.materials.append(material)

    modifier = truck.modifiers.new(name="Export triangulation", type="TRIANGULATE")
    modifier.quad_method = "BEAUTY"
    modifier.ngon_method = "BEAUTY"
    bpy.context.view_layer.objects.active = truck
    bpy.ops.object.modifier_apply(modifier=modifier.name)
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
    points = [truck.matrix_world @ vertex.co for vertex in truck.data.vertices]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    triangle_count = len(truck.data.loop_triangles)
    material_names = [material.name for material in truck.data.materials]

    if not 850 <= triangle_count <= 1200:
        raise RuntimeError(f"Triangle count outside required range: {triangle_count}")
    if set(material_names) != EXPECTED_MATERIALS:
        raise RuntimeError(f"Unexpected materials: {material_names}")
    if abs(minimum.z) > 1e-5:
        raise RuntimeError(f"Wheels are not grounded: min Z={minimum.z}")
    if abs((minimum.x + maximum.x) * 0.5) > 1e-5:
        raise RuntimeError("Longitudinal origin is not centered")
    if abs((minimum.y + maximum.y) * 0.5) > 1e-5:
        raise RuntimeError("Lateral origin is not centered")

    print(
        "TRUCK_V2_METRICS",
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

    body = create_material("body", (0.16, 0.25, 0.31), 0.91)
    cabin = create_material("cabin", (0.52, 0.60, 0.64), 0.88)
    wheel = create_material("wheel", (0.018, 0.022, 0.026), 0.96)
    glass = create_material("glass", (0.025, 0.065, 0.095), 0.86)
    detail = create_material("detail", (0.055, 0.065, 0.070), 0.93)
    materials = [body, cabin, glass, wheel, detail]

    objects = [
        add_box(
            "LongCargoBox",
            location=(-1.55, 0.0, 1.88),
            dimensions=(5.20, 2.36, 2.98),
            material=body,
            bevel=0.07,
            segments=2,
        ),
        add_box(
            "VisibleDarkChassis",
            location=(0.0, 0.0, 0.33),
            dimensions=(7.55, 1.76, 0.30),
            material=detail,
            bevel=0.05,
            segments=2,
        ),
        add_cabin(cabin),
        add_windshield(glass),
        add_box(
            "FrontGrille",
            location=(3.76, 0.0, 1.20),
            dimensions=(0.075, 1.46, 0.46),
            material=detail,
            bevel=0.025,
            segments=1,
        ),
        add_box(
            "LeftHeadlight",
            location=(3.805, -0.73, 1.72),
            dimensions=(0.065, 0.34, 0.22),
            material=detail,
            bevel=0.02,
            segments=1,
        ),
        add_box(
            "RightHeadlight",
            location=(3.805, 0.73, 1.72),
            dimensions=(0.065, 0.34, 0.22),
            material=detail,
            bevel=0.02,
            segments=1,
        ),
    ]
    for axle_name, axle_x in (("Rear", -2.55), ("Front", 2.45)):
        for side_name, side in (("Left", -1), ("Right", 1)):
            objects.append(
                add_wheel(
                    f"{axle_name}Wheel{side_name}",
                    axle_x,
                    side,
                    wheel,
                )
            )

    truck = join_and_triangulate(objects, materials)
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
    print(f"TRUCK_V2_OUTPUT {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
