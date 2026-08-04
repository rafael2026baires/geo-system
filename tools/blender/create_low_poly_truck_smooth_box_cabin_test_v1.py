"""Create an isolated smooth-box truck variant with a 15% taller cab."""

from hashlib import sha256
import json
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = (
    PROJECT_ROOT
    / "public"
    / "assets"
    / "models"
    / "3d"
    / "low_poly_truck_smooth_box_v1.glb"
)
OUTPUT_PATH = SOURCE_PATH.with_name(
    "low_poly_truck_smooth_box_cabin_test_v1.glb"
)

CABIN_HEIGHT_FACTOR = 1.30
CABIN_REAR_X = -100.0
CARGO_FRONT_X = -103.0
EPSILON = 1e-5

FULL_CABIN_MATERIALS = {"cabin", "glass", "haedlights"}
MIXED_FRONT_MATERIALS = {"body", "black"}
EXPECTED_MATERIALS = {
    "body",
    "black",
    "cabin",
    "haedlights",
    "glass",
    "wheel",
}


def file_sha256(path):
    digest = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def objects_by_material(objects):
    result = {}
    for obj in objects:
        if len(obj.data.materials) != 1:
            raise RuntimeError(f"Expected one material on {obj.name}")
        material_name = obj.data.materials[0].name
        if material_name in result:
            raise RuntimeError(f"Duplicate material object: {material_name}")
        result[material_name] = obj
    return result


def world_points(obj):
    matrix = obj.matrix_world
    return [matrix @ vertex.co for vertex in obj.data.vertices]


def object_bounds(obj):
    points = world_points(obj)
    return {
        "min": [min(point[axis] for point in points) for axis in range(3)],
        "max": [max(point[axis] for point in points) for axis in range(3)],
    }


def scene_bounds(objects):
    points = [point for obj in objects for point in world_points(obj)]
    return {
        "min": [min(point[axis] for point in points) for axis in range(3)],
        "max": [max(point[axis] for point in points) for axis in range(3)],
    }


def triangle_count(obj):
    return sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)


def geometry_snapshot(objects):
    return {
        obj.data.materials[0].name: [tuple(point) for point in world_points(obj)]
        for obj in objects
    }


def transform_blender_vertical_z(obj, vertex_indices, pivot_z):
    inverse = obj.matrix_world.inverted()
    for index in vertex_indices:
        vertex = obj.data.vertices[index]
        point = obj.matrix_world @ vertex.co
        point.z = pivot_z + ((point.z - pivot_z) * CABIN_HEIGHT_FACTOR)
        vertex.co = inverse @ point
    obj.data.update()


def full_object_vertex_indices(obj):
    return [vertex.index for vertex in obj.data.vertices]


def mixed_front_vertex_indices(obj, pivot_z):
    matrix = obj.matrix_world
    return [
        vertex.index
        for vertex in obj.data.vertices
        if (matrix @ vertex.co).x >= CABIN_REAR_X - EPSILON
        and (matrix @ vertex.co).z >= pivot_z - EPSILON
    ]


def validate_unchanged_axis(before, after, axis, label):
    for material_name, before_points in before.items():
        after_points = after[material_name]
        for index, point_before in enumerate(before_points):
            if abs(point_before[axis] - after_points[index][axis]) > EPSILON:
                raise RuntimeError(
                    f"{label} changed on {material_name} vertex {index}"
                )


def validate_protected_geometry(before, after, selected_indices):
    if before["wheel"] != after["wheel"]:
        raise RuntimeError("Wheel geometry changed")

    for material_name in MIXED_FRONT_MATERIALS:
        selected = set(selected_indices[material_name])
        for index, point_before in enumerate(before[material_name]):
            point_after = after[material_name][index]
            if index not in selected and point_before != point_after:
                raise RuntimeError(
                    f"Protected {material_name} vertex changed: {index}"
                )
            if point_before[0] <= CARGO_FRONT_X + EPSILON and point_before != point_after:
                raise RuntimeError(
                    f"Cargo/chassis-side {material_name} vertex changed: {index}"
                )


def apply_world_transforms(objects):
    for obj in objects:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def rounded_bounds(bounds):
    return {
        key: [round(value, 6) for value in values]
        for key, values in bounds.items()
    }


def main():
    if not SOURCE_PATH.is_file():
        raise FileNotFoundError(SOURCE_PATH)
    source_hash_before = file_sha256(SOURCE_PATH)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_PATH))

    objects = mesh_objects()
    by_material = objects_by_material(objects)
    if set(by_material) != EXPECTED_MATERIALS:
        raise RuntimeError(
            f"Unexpected imported materials: {sorted(by_material)}"
        )

    before_scene_bounds = scene_bounds(objects)
    before_object_bounds = {
        name: object_bounds(obj) for name, obj in by_material.items()
    }
    before_geometry = geometry_snapshot(objects)
    before_triangles = {
        name: triangle_count(obj) for name, obj in by_material.items()
    }

    # Blender converts glTF Y-up to Z-up while importing. Scaling Blender Z
    # therefore changes only local glTF Y after export.
    pivot_z = before_object_bounds["cabin"]["min"][2]
    semantic_group = bpy.data.objects.new("CabinHeightTestPivot", None)
    semantic_group.location = (0.0, 0.0, pivot_z)
    bpy.context.scene.collection.objects.link(semantic_group)

    selected_indices = {}
    for material_name in FULL_CABIN_MATERIALS:
        obj = by_material[material_name]
        indices = full_object_vertex_indices(obj)
        selected_indices[material_name] = indices
        transform_blender_vertical_z(obj, indices, pivot_z)

    for material_name in MIXED_FRONT_MATERIALS:
        obj = by_material[material_name]
        indices = mixed_front_vertex_indices(obj, pivot_z)
        if not indices:
            raise RuntimeError(f"No safe front vertices found in {material_name}")
        selected_indices[material_name] = indices
        transform_blender_vertical_z(obj, indices, pivot_z)

    bpy.data.objects.remove(semantic_group, do_unlink=True)

    after_geometry = geometry_snapshot(objects)
    validate_unchanged_axis(before_geometry, after_geometry, 0, "X")
    validate_unchanged_axis(before_geometry, after_geometry, 1, "Blender Y / glTF Z")
    validate_protected_geometry(before_geometry, after_geometry, selected_indices)

    after_object_bounds = {
        name: object_bounds(obj) for name, obj in by_material.items()
    }
    after_scene_bounds = scene_bounds(objects)
    after_triangles = {
        name: triangle_count(obj) for name, obj in by_material.items()
    }

    cabin_height_before = (
        before_object_bounds["cabin"]["max"][2]
        - before_object_bounds["cabin"]["min"][2]
    )
    cabin_height_after = (
        after_object_bounds["cabin"]["max"][2]
        - after_object_bounds["cabin"]["min"][2]
    )
    if abs((cabin_height_after / cabin_height_before) - CABIN_HEIGHT_FACTOR) > EPSILON:
        raise RuntimeError("Cabin height factor validation failed")
    if abs(after_object_bounds["cabin"]["min"][2] - pivot_z) > EPSILON:
        raise RuntimeError("Cabin lower edge moved")
    if before_triangles != after_triangles:
        raise RuntimeError("Triangle counts changed")
    for axis in (0, 1):
        if abs(before_scene_bounds["min"][axis] - after_scene_bounds["min"][axis]) > EPSILON:
            raise RuntimeError("Global footprint minimum changed")
        if abs(before_scene_bounds["max"][axis] - after_scene_bounds["max"][axis]) > EPSILON:
            raise RuntimeError("Global footprint maximum changed")
    if abs(before_scene_bounds["min"][2] - after_scene_bounds["min"][2]) > EPSILON:
        raise RuntimeError("Global support minimum changed")

    apply_world_transforms(objects)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = by_material["body"]
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

    if source_hash_before != file_sha256(SOURCE_PATH):
        raise RuntimeError("Source GLB changed during generation")

    metrics = {
        "source_sha256": source_hash_before,
        "output_sha256": file_sha256(OUTPUT_PATH),
        "pivot_gltf_y": pivot_z,
        "factor": CABIN_HEIGHT_FACTOR,
        "selected_vertices": {
            name: len(indices) for name, indices in selected_indices.items()
        },
        "scene_bounds_before": rounded_bounds(before_scene_bounds),
        "scene_bounds_after": rounded_bounds(after_scene_bounds),
        "object_bounds_before": {
            name: rounded_bounds(bounds)
            for name, bounds in before_object_bounds.items()
        },
        "object_bounds_after": {
            name: rounded_bounds(bounds)
            for name, bounds in after_object_bounds.items()
        },
        "triangles": after_triangles,
        "materials": sorted(by_material),
    }
    print("CABIN_TEST_METRICS", json.dumps(metrics, sort_keys=True))
    print(f"CABIN_TEST_OUTPUT {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
