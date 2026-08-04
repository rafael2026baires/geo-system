"""Lower only the cargo box of the validated 1.30-height cab variant."""

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
    / "low_poly_truck_smooth_box_cabin_test_v1.glb"
)
OUTPUT_PATH = SOURCE_PATH.with_name(
    "low_poly_truck_smooth_box_cabin_box_test_v1.glb"
)

BOX_LOWERING_RATIO = 0.15
BOX_MAX_X = -103.0
BOX_MIN_GLTF_Y = 107.0
EPSILON = 1e-4

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


def geometry_snapshot(objects):
    return {
        obj.data.materials[0].name: [tuple(point) for point in world_points(obj)]
        for obj in objects
    }


def bounds_from_points(points):
    return {
        "min": [min(point[axis] for point in points) for axis in range(3)],
        "max": [max(point[axis] for point in points) for axis in range(3)],
    }


def object_bounds(obj):
    return bounds_from_points(world_points(obj))


def scene_bounds(objects):
    return bounds_from_points(
        [point for obj in objects for point in world_points(obj)]
    )


def triangle_count(obj):
    return sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)


def box_vertex_indices(body_obj):
    # Blender imports glTF Y-up as Z-up. Blender Z is local glTF Y here.
    matrix = body_obj.matrix_world
    return [
        vertex.index
        for vertex in body_obj.data.vertices
        if (matrix @ vertex.co).x <= BOX_MAX_X + EPSILON
        and (matrix @ vertex.co).z >= BOX_MIN_GLTF_Y - EPSILON
    ]


def validate_closed_polygon_selection(body_obj, selected_indices):
    selected = set(selected_indices)
    selected_polygons = 0
    for polygon in body_obj.data.polygons:
        selected_count = sum(index in selected for index in polygon.vertices)
        if selected_count not in (0, len(polygon.vertices)):
            raise RuntimeError(
                f"Box selection cuts polygon {polygon.index}: "
                f"{selected_count}/{len(polygon.vertices)} vertices"
            )
        if selected_count == len(polygon.vertices):
            selected_polygons += 1
    if selected_polygons == 0:
        raise RuntimeError("No closed cargo-box polygons selected")
    return selected_polygons


def translate_box_on_blender_z(body_obj, selected_indices, delta_z):
    inverse = body_obj.matrix_world.inverted()
    for index in selected_indices:
        vertex = body_obj.data.vertices[index]
        point = body_obj.matrix_world @ vertex.co
        point.z += delta_z
        vertex.co = inverse @ point
    body_obj.data.update()


def validate_geometry(before, after, selected_indices, delta_z):
    selected = set(selected_indices)
    for material_name, before_points in before.items():
        after_points = after[material_name]
        for index, point_before in enumerate(before_points):
            point_after = after_points[index]
            if material_name == "body" and index in selected:
                if abs(point_before[0] - point_after[0]) > EPSILON:
                    raise RuntimeError(f"Box X changed at vertex {index}")
                if abs(point_before[1] - point_after[1]) > EPSILON:
                    raise RuntimeError(f"Box width changed at vertex {index}")
                if abs((point_after[2] - point_before[2]) - delta_z) > EPSILON:
                    raise RuntimeError(f"Box translation mismatch at vertex {index}")
            elif point_before != point_after:
                raise RuntimeError(
                    f"Protected geometry changed: {material_name} vertex {index}"
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

    before_geometry = geometry_snapshot(objects)
    before_scene_bounds = scene_bounds(objects)
    before_object_bounds = {
        name: object_bounds(obj) for name, obj in by_material.items()
    }
    before_triangles = {
        name: triangle_count(obj) for name, obj in by_material.items()
    }

    body_obj = by_material["body"]
    selected_indices = box_vertex_indices(body_obj)
    selected_polygons = validate_closed_polygon_selection(
        body_obj,
        selected_indices,
    )
    selected_points_before = [
        before_geometry["body"][index] for index in selected_indices
    ]
    box_bounds_before = bounds_from_points(selected_points_before)
    box_height = box_bounds_before["max"][2] - box_bounds_before["min"][2]
    lowering_distance = box_height * BOX_LOWERING_RATIO
    delta_z = -lowering_distance

    translate_box_on_blender_z(body_obj, selected_indices, delta_z)

    after_geometry = geometry_snapshot(objects)
    validate_geometry(before_geometry, after_geometry, selected_indices, delta_z)

    after_scene_bounds = scene_bounds(objects)
    after_object_bounds = {
        name: object_bounds(obj) for name, obj in by_material.items()
    }
    after_triangles = {
        name: triangle_count(obj) for name, obj in by_material.items()
    }
    selected_points_after = [
        after_geometry["body"][index] for index in selected_indices
    ]
    box_bounds_after = bounds_from_points(selected_points_after)

    if before_triangles != after_triangles:
        raise RuntimeError("Triangle counts changed")
    for axis in (0, 1):
        if abs(before_scene_bounds["min"][axis] - after_scene_bounds["min"][axis]) > EPSILON:
            raise RuntimeError("Global length/width minimum changed")
        if abs(before_scene_bounds["max"][axis] - after_scene_bounds["max"][axis]) > EPSILON:
            raise RuntimeError("Global length/width maximum changed")
    if abs(before_scene_bounds["min"][2] - after_scene_bounds["min"][2]) > EPSILON:
        raise RuntimeError("Global support minimum changed")

    box_height_after = box_bounds_after["max"][2] - box_bounds_after["min"][2]
    if abs(box_height - box_height_after) > EPSILON:
        raise RuntimeError("Cargo box deformed")
    for bound_name in ("min", "max"):
        actual_delta = (
            box_bounds_after[bound_name][2]
            - box_bounds_before[bound_name][2]
        )
        if abs(actual_delta - delta_z) > EPSILON:
            raise RuntimeError("Cargo box did not translate rigidly")

    apply_world_transforms(objects)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body_obj
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
        raise RuntimeError("Cabin-test source GLB changed during generation")

    metrics = {
        "source_sha256": source_hash_before,
        "output_sha256": file_sha256(OUTPUT_PATH),
        "box_lowering_ratio": BOX_LOWERING_RATIO,
        "box_lowering_distance_gltf_y": lowering_distance,
        "selected_box_vertices": len(selected_indices),
        "selected_box_polygons": selected_polygons,
        "box_bounds_before": rounded_bounds(box_bounds_before),
        "box_bounds_after": rounded_bounds(box_bounds_after),
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
    print("CABIN_BOX_TEST_METRICS", json.dumps(metrics, sort_keys=True))
    print(f"CABIN_BOX_TEST_OUTPUT {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
