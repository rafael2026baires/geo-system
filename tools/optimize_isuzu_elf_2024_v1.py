import argparse
import hashlib
import json
import math
import os
from collections import Counter, defaultdict

import bpy
from mathutils import Vector


def parse_args():
    argv = []
    if "--" in __import__("sys").argv:
        argv = __import__("sys").argv[__import__("sys").argv.index("--") + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("inspect", "optimize", "validate", "render"), required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path, import_pack_images=True)


def world_bbox(objects):
    points = []
    for obj in objects:
        if obj.type == "MESH":
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {"min": low, "max": high, "dimensions": [high[i] - low[i] for i in range(3)]}


def image_info(image):
    return {
        "name": image.name,
        "size": list(image.size),
        "source": image.source,
        "file_format": image.file_format,
        "packed": image.packed_file is not None,
        "filepath": image.filepath,
    }


def mesh_metrics(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return {
        "name": obj.name,
        "mesh": mesh.name,
        "vertices": len(mesh.vertices),
        "edges": len(mesh.edges),
        "faces": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
        "location": list(obj.location),
        "rotation_euler": list(obj.rotation_euler),
        "scale": list(obj.scale),
        "dimensions": list(obj.dimensions),
        "parent": obj.parent.name if obj.parent else None,
        "visible": not obj.hide_render,
    }


def inspect(path):
    reset_scene()
    import_glb(path)
    objects = list(bpy.data.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    per_mesh = [mesh_metrics(obj) for obj in meshes]
    material_users = Counter()
    estimated_draw_calls = 0
    for obj in meshes:
        used = {p.material_index for p in obj.data.polygons} or {0}
        estimated_draw_calls += len(used)
        for slot in obj.material_slots:
            if slot.material:
                material_users[slot.material.name] += 1
    duplicate_mesh_data = defaultdict(list)
    for obj in meshes:
        duplicate_mesh_data[obj.data.name].append(obj.name)
    duplicate_material_signatures = defaultdict(list)
    for mat in bpy.data.materials:
        signature = (mat.diffuse_color[:], mat.blend_method if hasattr(mat, "blend_method") else "")
        duplicate_material_signatures[str(signature)].append(mat.name)
    result = {
        "path": os.path.abspath(path),
        "size_bytes": os.path.getsize(path),
        "objects": len(objects),
        "object_types": dict(Counter(obj.type for obj in objects)),
        "meshes": len(meshes),
        "vertices": sum(x["vertices"] for x in per_mesh),
        "edges": sum(x["edges"] for x in per_mesh),
        "faces": sum(x["faces"] for x in per_mesh),
        "triangles": sum(x["triangles"] for x in per_mesh),
        "materials": len(bpy.data.materials),
        "images": [image_info(image) for image in bpy.data.images],
        "textures": len(bpy.data.images),
        "animations": len(bpy.data.actions),
        "armatures": sum(obj.type == "ARMATURE" for obj in objects),
        "cameras": sum(obj.type == "CAMERA" for obj in objects),
        "lights": sum(obj.type == "LIGHT" for obj in objects),
        "empties": sum(obj.type == "EMPTY" for obj in objects),
        "estimated_draw_calls": estimated_draw_calls,
        "bbox": world_bbox(meshes),
        "scene_root_objects": [obj.name for obj in objects if obj.parent is None],
        "nodes": [{
            "name": obj.name,
            "type": obj.type,
            "parent": obj.parent.name if obj.parent else None,
            "location": list(obj.location),
            "rotation_euler": list(obj.rotation_euler),
            "scale": list(obj.scale),
            "matrix_world_translation": list(obj.matrix_world.translation),
        } for obj in objects],
        "per_mesh": sorted(per_mesh, key=lambda x: x["triangles"], reverse=True),
        "duplicate_mesh_data": {k: v for k, v in duplicate_mesh_data.items() if len(v) > 1},
        "possible_duplicate_materials": [v for v in duplicate_material_signatures.values() if len(v) > 1],
        "materials_detail": [{
            "name": m.name,
            "users": m.users,
            "slots": material_users[m.name],
            "diffuse_color": list(m.diffuse_color),
            "surface_render_method": getattr(m, "surface_render_method", None),
            "use_nodes": m.use_nodes,
        } for m in bpy.data.materials],
    }
    return result


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)


def optimize(input_path, output_path):
    reset_scene()
    import_glb(input_path)
    before = inspect_loaded_scene(input_path)
    removed = {"cameras": 0, "lights": 0, "armatures": 0}
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT", "ARMATURE"}:
            removed[obj.type.lower() + "s"] += 1
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in [obj for obj in bpy.data.objects if obj.type == "MESH"]:
        modifier = obj.modifiers.new(name="Conservative_Decimate_V1", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = 0.12
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    return {"input_before": before, "removed": removed, "requested_decimate_ratio": 0.12}


def inspect_loaded_scene(path):
    objects = list(bpy.data.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    per_mesh = [mesh_metrics(obj) for obj in meshes]
    return {
        "path": os.path.abspath(path),
        "objects": len(objects),
        "meshes": len(meshes),
        "vertices": sum(x["vertices"] for x in per_mesh),
        "faces": sum(x["faces"] for x in per_mesh),
        "triangles": sum(x["triangles"] for x in per_mesh),
        "materials": len(bpy.data.materials),
        "textures": len(bpy.data.images),
        "bbox": world_bbox(meshes),
    }


def render_validation(input_path, output_path):
    reset_scene()
    import_glb(input_path)
    bbox = world_bbox(list(bpy.data.objects))
    center = Vector([(bbox["min"][i] + bbox["max"][i]) / 2 for i in range(3)])
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("ValidationWorld")
    scene.world.color = (0.045, 0.045, 0.045)
    camera_data = bpy.data.cameras.new("ValidationCamera")
    camera = bpy.data.objects.new("ValidationCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(bbox["dimensions"]) * 1.35
    camera.location = center + Vector((1.4, -1.7, 1.05))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    for idx, location in enumerate(((1.5, -1.0, 2.2), (-1.2, -0.4, 1.4))):
        light_data = bpy.data.lights.new(f"ValidationLight{idx}", "AREA")
        light_data.energy = 700 if idx == 0 else 350
        light_data.shape = "DISK"
        light_data.size = 4
        light = bpy.data.objects.new(f"ValidationLight{idx}", light_data)
        scene.collection.objects.link(light)
        light.location = center + Vector(location)
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    if args.mode == "inspect":
        write_json(args.report, inspect(args.input))
        return
    if args.mode == "optimize":
        if not args.output:
            raise ValueError("--output is required for optimize")
        write_json(args.report, optimize(args.input, args.output))
        return
    if args.mode == "validate":
        write_json(args.report, inspect(args.input))
        return
    if args.mode == "render":
        if not args.output:
            raise ValueError("--output is required for render")
        render_validation(args.input, args.output)
        write_json(args.report, {"input": os.path.abspath(args.input), "render": os.path.abspath(args.output)})
        return


if __name__ == "__main__":
    main()
