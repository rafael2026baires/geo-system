"""Create a smooth-box variant by editing only the original cargo overlays."""

from hashlib import sha256
from pathlib import Path

import bmesh
import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = (
    PROJECT_ROOT
    / "public"
    / "assets"
    / "models"
    / "3d"
    / "low_poly_truck.glb"
)
OUTPUT_PATH = SOURCE_PATH.with_name("low_poly_truck_smooth_box_v1.glb")

CARGO_MAX_X = -100.0
CARGO_MIN_Z = 105.0
EXPECTED_REMOVED_FACES = 156
EXPECTED_REMOVED_TRIANGLES = 156


def world_geometry_signature(obj):
    digest = sha256()
    mesh = obj.data
    matrix = obj.matrix_world
    triangles = []
    for polygon in mesh.polygons:
        points = [
            tuple(round(value, 3) for value in (matrix @ mesh.vertices[index].co))
            for index in polygon.vertices
        ]
        anchor = min(range(len(points)), key=points.__getitem__)
        normalized = points[anchor:] + points[:anchor]
        reverse = [normalized[0]] + list(reversed(normalized[1:]))
        triangles.append(min(tuple(normalized), tuple(reverse)))
    for polygon in sorted(triangles):
        digest.update(repr(polygon).encode("ascii"))
    return digest.hexdigest()


def is_cargo_overlay_face(obj, face):
    points = [obj.matrix_world @ vertex.co for vertex in face.verts]
    return (
        max(point.x for point in points) <= CARGO_MAX_X
        and min(point.z for point in points) >= CARGO_MIN_Z
    )


def remove_black_cargo_overlays(black_obj):
    mesh = black_obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    target_faces = [
        face for face in bm.faces
        if is_cargo_overlay_face(black_obj, face)
    ]
    removed_triangles = sum(len(face.verts) - 2 for face in target_faces)

    if len(target_faces) != EXPECTED_REMOVED_FACES:
        raise RuntimeError(
            f"Unexpected cargo overlay face count: {len(target_faces)}"
        )
    if removed_triangles != EXPECTED_REMOVED_TRIANGLES:
        raise RuntimeError(
            f"Unexpected cargo overlay triangle count: {removed_triangles}"
        )

    bmesh.ops.delete(bm, geom=target_faces, context="FACES")
    unused_vertices = [
        vertex for vertex in bm.verts
        if not vertex.link_faces and not vertex.link_edges
    ]
    if unused_vertices:
        bmesh.ops.delete(bm, geom=unused_vertices, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.calc_loop_triangles()
    return len(target_faces), removed_triangles


def scene_bounds(mesh_objects):
    points = [
        obj.matrix_world @ vertex.co
        for obj in mesh_objects
        for vertex in obj.data.vertices
    ]
    minimum = tuple(min(point[index] for point in points) for index in range(3))
    maximum = tuple(max(point[index] for point in points) for index in range(3))
    return minimum, maximum


def world_geometry_metrics(obj):
    points = [
        obj.matrix_world @ vertex.co
        for vertex in obj.data.vertices
    ]
    return {
        "polygons": len(obj.data.polygons),
        "triangles": sum(
            len(polygon.vertices) - 2
            for polygon in obj.data.polygons
        ),
        "minimum": tuple(
            round(min(point[index] for point in points), 2)
            for index in range(3)
        ),
        "maximum": tuple(
            round(max(point[index] for point in points), 2)
            for index in range(3)
        ),
    }


def apply_world_transforms(mesh_objects):
    for obj in mesh_objects:
        world_matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world_matrix
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(
            location=True,
            rotation=True,
            scale=True,
        )


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_PATH))

    mesh_objects = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH"
    ]
    objects_by_material = {
        obj.data.materials[0].name: obj
        for obj in mesh_objects
        if len(obj.data.materials) == 1
    }
    expected_materials = {
        "body",
        "black",
        "cabin",
        "haedlights",
        "glass",
        "wheel",
    }
    if set(objects_by_material) != expected_materials:
        raise RuntimeError(
            f"Unexpected imported materials: {sorted(objects_by_material)}"
        )

    protected_materials = {
        "body",
        "cabin",
        "haedlights",
        "glass",
        "wheel",
    }
    signatures_before = {
        name: world_geometry_signature(objects_by_material[name])
        for name in protected_materials
    }
    metrics_before = {
        name: world_geometry_metrics(objects_by_material[name])
        for name in protected_materials
    }
    original_black_faces = len(objects_by_material["black"].data.polygons)
    original_black_triangles = sum(
        len(polygon.vertices) - 2
        for polygon in objects_by_material["black"].data.polygons
    )

    removed_faces, removed_triangles = remove_black_cargo_overlays(
        objects_by_material["black"]
    )

    signatures_after = {
        name: world_geometry_signature(objects_by_material[name])
        for name in protected_materials
    }
    if signatures_before != signatures_after:
        raise RuntimeError("Protected geometry changed during cargo cleanup")

    black_obj = objects_by_material["black"]
    remaining_black_faces = len(black_obj.data.polygons)
    remaining_black_triangles = sum(
        len(polygon.vertices) - 2
        for polygon in black_obj.data.polygons
    )
    if remaining_black_faces != original_black_faces - removed_faces:
        raise RuntimeError("Unexpected remaining black face count")
    if remaining_black_triangles != original_black_triangles - removed_triangles:
        raise RuntimeError("Unexpected remaining black triangle count")

    apply_world_transforms(mesh_objects)
    metrics_applied = {
        name: world_geometry_metrics(objects_by_material[name])
        for name in protected_materials
    }
    if metrics_before != metrics_applied:
        raise RuntimeError("Protected geometry changed while applying transforms")

    minimum, maximum = scene_bounds(mesh_objects)
    print(
        "SMOOTH_BOX_METRICS",
        {
            "removed_faces": removed_faces,
            "removed_triangles": removed_triangles,
            "protected_signatures_match": True,
            "world_bounds_min": tuple(round(value, 5) for value in minimum),
            "world_bounds_max": tuple(round(value, 5) for value in maximum),
        },
    )

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects_by_material["body"]
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
    print(f"SMOOTH_BOX_OUTPUT {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
