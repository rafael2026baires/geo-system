from pathlib import Path
import math

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(r"C:\xampp\htdocs\apps\geo-system")
OUTPUT_PATH = PROJECT_ROOT / "public" / "assets" / "models" / "3d" / "warehouse.glb"
PREVIEW_DIR = OUTPUT_PATH.parent / "preview"

FRONT_DIRECTION_GLTF = "+Z"
MAIN_HALL_WALL_HEIGHT = 15.1
ROOF_VERTICAL_OFFSET = MAIN_HALL_WALL_HEIGHT - 8.0


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
    material.surface_render_method = "DITHERED"
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = roughness
    return material


def add_box(name, location, dimensions, material, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)

    if bevel > 0:
        modifier = obj.modifiers.new(name="EdgeSoftness", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    return obj


def add_roof_panel(name, x, angle, width, depth, thickness, z, material):
    obj = add_box(
        name,
        (x, 1.0, z),
        (width, depth, thickness),
        material,
        bevel=0.10,
    )
    obj.rotation_euler[1] = angle
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def add_cylinder(name, location, radius, depth, vertices, material):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        end_fill_type="NGON",
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    modifier = obj.modifiers.new(name="VentEdge", type="BEVEL")
    modifier.width = 0.07
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_ramp(name, x_center, y_front, width, length, height, material):
    half_width = width / 2
    vertices = [
        (x_center - half_width, y_front, 0),
        (x_center + half_width, y_front, 0),
        (x_center + half_width, y_front + length, 0),
        (x_center - half_width, y_front + length, 0),
        (x_center - half_width, y_front + length, height),
        (x_center + half_width, y_front + length, height),
    ]
    faces = [
        (0, 1, 2, 3),
        (3, 2, 5, 4),
        (0, 4, 5, 1),
        (0, 3, 4),
        (1, 5, 2),
    ]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def build_warehouse(materials):
    wall = materials["structure"]
    roof = materials["roof"]
    dark = materials["service"]
    admin = materials["admin"]
    accent = materials["accent"]
    objects = []

    # Nave central: volumen largo con cubierta a dos aguas.
    objects.append(add_box(
        "MainHall",
        (0, 1, MAIN_HALL_WALL_HEIGHT / 2),
        (42, 30, MAIN_HALL_WALL_HEIGHT),
        wall,
        0.14,
    ))
    slope_angle = math.atan2(4.2, 21.0)
    slope_length = math.hypot(21.0, 4.2) + 0.7
    objects.append(add_roof_panel(
        "RoofWest", -10.5, -slope_angle, slope_length, 31.2, 0.42,
        10.15 + ROOF_VERTICAL_OFFSET, roof
    ))
    objects.append(add_roof_panel(
        "RoofEast", 10.5, slope_angle, slope_length, 31.2, 0.42,
        10.15 + ROOF_VERTICAL_OFFSET, roof
    ))
    objects.append(add_box(
        "RoofRidge",
        (0, 1, 12.15 + ROOF_VERTICAL_OFFSET),
        (0.55, 31.0, 0.48),
        roof,
        0.08,
    ))

    # Aleros y zócalo: líneas largas legibles desde vista oblicua.
    objects.append(add_box(
        "FrontEave",
        (0, -14.35, 8.05 + ROOF_VERTICAL_OFFSET),
        (43.0, 0.45, 0.55),
        dark,
        0.07,
    ))
    objects.append(add_box(
        "BackEave",
        (0, 16.35, 8.05 + ROOF_VERTICAL_OFFSET),
        (43.0, 0.45, 0.55),
        dark,
        0.07,
    ))
    objects.append(add_box("FrontPlinth", (0, -14.10, 0.38), (42.2, 0.35, 0.76), dark, 0.05))
    objects.append(add_box("BackPlinth", (0, 16.10, 0.38), (42.2, 0.35, 0.76), dark, 0.05))

    # Sector administrativo asimétrico proyectado al frente.
    objects.append(add_box("AdminWing", (-12.2, -16.6, 3.25), (15.6, 5.2, 6.5), admin, 0.16))
    objects.append(add_box("AdminRoof", (-12.2, -16.6, 6.7), (16.3, 5.9, 0.42), roof, 0.10))
    objects.append(add_box("AdminCanopy", (-12.2, -19.55, 4.4), (10.8, 1.2, 0.38), dark, 0.08))
    objects.append(add_box("AdminDoor", (-16.4, -19.23, 1.55), (2.2, 0.24, 3.1), dark, 0.04))
    for index, x in enumerate((-12.4, -8.7)):
        objects.append(add_box(
            f"AdminWindow{index + 1}", (x, -19.24, 3.25), (2.7, 0.22, 1.55), accent, 0.04
        ))
    objects.append(add_box("AdminFascia", (-12.2, -19.25, 5.65), (15.1, 0.22, 0.62), accent, 0.04))
    for index, x in enumerate((-18.8, -15.4, -11.8, -8.1, -5.5)):
        objects.append(add_box(
            f"AdminFin{index + 1}", (x, -19.27, 3.1), (0.18, 0.20, 4.9), dark, 0.03
        ))

    # Dos portones principales con marcos robustos.
    door_centers = (5.2, 14.6)
    for index, x in enumerate(door_centers, start=1):
        objects.append(add_box(
            f"LoadingDoor{index}", (x, -14.22, 3.25), (7.0, 0.24, 5.5), dark, 0.05
        ))
        objects.append(add_box(
            f"DoorFrame{index}Left", (x - 3.72, -14.34, 3.3), (0.42, 0.44, 6.0), accent, 0.05
        ))
        objects.append(add_box(
            f"DoorFrame{index}Right", (x + 3.72, -14.34, 3.3), (0.42, 0.44, 6.0), accent, 0.05
        ))
        objects.append(add_box(
            f"DoorFrame{index}Top", (x, -14.34, 6.18), (7.85, 0.44, 0.42), accent, 0.05
        ))
        for stripe in range(1, 5):
            z = 0.8 + stripe * 0.95
            objects.append(add_box(
                f"Door{index}Panel{stripe}", (x, -14.36, z), (6.65, 0.08, 0.08), accent, 0.015
            ))

    # Muelle, topes y rampa lateral.
    objects.append(add_box("LoadingDock", (9.9, -16.4, 0.55), (20.2, 4.1, 1.1), dark, 0.10))
    objects.append(add_box("DockEdge", (9.9, -18.42, 0.62), (20.4, 0.28, 1.24), accent, 0.05))
    for index, x in enumerate((2.0, 8.3, 11.5, 17.8), start=1):
        objects.append(add_box(
            f"DockBumper{index}", (x, -18.62, 0.56), (0.65, 0.35, 0.92), accent, 0.04
        ))
    objects.append(add_ramp("DockRamp", 20.7, -20.0, 4.0, 3.6, 1.1, dark))

    # Volumen lateral secundario y acceso de servicio.
    objects.append(add_box("SideAnnex", (23.0, 4.2, 2.8), (4.0, 18.0, 5.6), admin, 0.14))
    objects.append(add_box("SideAnnexRoof", (23.0, 4.2, 5.82), (4.6, 18.6, 0.45), roof, 0.10))
    objects.append(add_box("SideServiceDoor", (25.05, 1.0, 1.55), (0.22, 2.5, 3.1), dark, 0.04))
    objects.append(add_box("SideServiceCanopy", (25.35, 1.0, 3.75), (0.9, 4.0, 0.3), accent, 0.05))
    for index, y in enumerate((-3.0, 3.0, 9.0), start=1):
        objects.append(add_box(
            f"AnnexPanel{index}", (25.06, y, 3.4), (0.20, 3.4, 1.1), accent, 0.03
        ))

    # Pilastras laterales y posteriores para romper planos grandes.
    for side, x in (("West", -21.12), ("East", 21.12)):
        for index, y in enumerate((-9.5, -3.5, 2.5, 8.5, 14.0), start=1):
            objects.append(add_box(
                f"{side}Pier{index}", (x, y, 7.65), (0.32, 0.58, 14.5), dark, 0.04
            ))
    for index, x in enumerate((-17.0, -10.0, -3.0, 4.0, 11.0, 18.0), start=1):
        objects.append(add_box(
            f"BackPier{index}", (x, 16.18, 7.65), (0.42, 0.35, 14.5), dark, 0.04
        ))

    # Elementos de cubierta: dos lucarnas y equipos bajos.
    for index, x in enumerate((-8.0, 8.0), start=1):
        objects.append(add_box(
            f"RoofLight{index}", (x, 1.0, 11.35 + ROOF_VERTICAL_OFFSET),
            (2.2, 16.0, 0.32), accent, 0.06
        ))
    for index, (x, y) in enumerate(((-12.0, -6.0), (-12.0, 7.0), (12.0, -5.0), (12.0, 8.0)), start=1):
        objects.append(add_box(
            f"RoofUnit{index}", (x, y, 11.55 + ROOF_VERTICAL_OFFSET),
            (2.8, 3.2, 0.8), dark, 0.10
        ))
        objects.append(add_box(
            f"RoofUnitCap{index}", (x, y, 12.02 + ROOF_VERTICAL_OFFSET),
            (2.3, 2.7, 0.20), accent, 0.05
        ))
    for index, (x, y) in enumerate(((-4.0, -5.0), (4.0, 6.0), (0.0, 11.0)), start=1):
        objects.append(add_cylinder(
            f"RoofVent{index}", (x, y, 12.35 + ROOF_VERTICAL_OFFSET),
            0.55, 0.85, 12, dark
        ))
        objects.append(add_cylinder(
            f"RoofVentCap{index}", (x, y, 12.82 + ROOF_VERTICAL_OFFSET),
            0.72, 0.18, 12, accent
        ))

    return objects


def join_and_finalize(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    warehouse = bpy.context.object
    warehouse.name = "GeoSystem_Logistics_Warehouse"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Triangulación explícita: evita n-gons y deja métricas deterministas.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    bpy.ops.mesh.remove_doubles(threshold=0.00001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Normalización geométrica: centro horizontal real en el origen y suelo en Z=0.
    corners = [warehouse.matrix_world @ Vector(corner) for corner in warehouse.bound_box]
    min_corner = Vector((
        min(c.x for c in corners),
        min(c.y for c in corners),
        min(c.z for c in corners),
    ))
    max_corner = Vector((
        max(c.x for c in corners),
        max(c.y for c in corners),
        max(c.z for c in corners),
    ))
    center_x = (min_corner.x + max_corner.x) / 2
    center_y = (min_corner.y + max_corner.y) / 2

    for vertex in warehouse.data.vertices:
        vertex.co.x -= center_x
        vertex.co.y -= center_y
        vertex.co.z -= min_corner.z

    warehouse.location = (0, 0, 0)
    warehouse.rotation_euler = (0, 0, 0)
    warehouse.scale = (1, 1, 1)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")

    # Elimina slots sin uso después del join.
    bpy.context.view_layer.objects.active = warehouse
    bpy.ops.object.material_slot_remove_unused()

    for polygon in warehouse.data.polygons:
        polygon.use_smooth = False

    warehouse.data.validate(clean_customdata=True)
    warehouse.data.update()
    return warehouse


def mesh_metrics(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    triangles = len(mesh.loop_triangles)
    vertices = len(mesh.vertices)
    edges = len(mesh.edges)
    polygons = len(mesh.polygons)
    evaluated.to_mesh_clear()

    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((
        min(c.x for c in corners),
        min(c.y for c in corners),
        min(c.z for c in corners),
    ))
    maximum = Vector((
        max(c.x for c in corners),
        max(c.y for c in corners),
        max(c.z for c in corners),
    ))
    dimensions = maximum - minimum
    return {
        "triangles": triangles,
        "vertices": vertices,
        "edges": edges,
        "polygons": polygons,
        "minimum": minimum,
        "maximum": maximum,
        "dimensions": dimensions,
    }


def export_glb(warehouse):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    warehouse.select_set(True)
    bpy.context.view_layer.objects.active = warehouse

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


def configure_preview_scene(warehouse, materials):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.025, 0.035, 0.05)

    ground_material = make_material("PreviewGround", (0.045, 0.06, 0.08), 0.95)
    ground = add_box("PreviewGround", (0, 0, -0.18), (78, 70, 0.30), ground_material, 0)
    ground.hide_render = False

    bpy.ops.object.light_add(type="AREA", location=(-30, -35, 48))
    key = bpy.context.object
    key.name = "PreviewKey"
    key.data.energy = 1650
    key.data.shape = "DISK"
    key.data.size = 24
    look_at(key, (0, 0, 4))

    bpy.ops.object.light_add(type="AREA", location=(34, 18, 28))
    fill = bpy.context.object
    fill.name = "PreviewFill"
    fill.data.energy = 900
    fill.data.size = 28
    look_at(fill, (0, 0, 5))

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 40))
    sun = bpy.context.object
    sun.name = "PreviewSun"
    sun.rotation_euler = (math.radians(28), math.radians(-20), math.radians(25))
    sun.data.energy = 1.5
    sun.data.angle = math.radians(18)

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "InspectionCamera"
    camera.data.lens = 52
    camera.data.sensor_width = 36
    scene.camera = camera

    # El warehouse sigue seleccionado solo para export; elementos de preview no se exportan.
    return camera, ground


def render_previews(camera):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    views = {
        "warehouse_front.png": ((46, -63, 39), (0, -1, 8.0), 52),
        "warehouse_back.png": ((-45, 63, 37), (0, 1, 8.0), 52),
        "warehouse_side.png": ((90, 4, 34), (0, 1, 7.8), 52),
        "warehouse_map_view.png": ((57, -68, 73), (0, 0, 7.0), 55),
    }

    for filename, (location, target, lens) in views.items():
        camera.location = location
        camera.data.lens = lens
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(PREVIEW_DIR / filename)
        bpy.ops.render.render(write_still=True)
        print(f"WAREHOUSE_PREVIEW {PREVIEW_DIR / filename}")


def main():
    clear_scene()
    materials = {
        "structure": make_material("structure", (0.60, 0.64, 0.68), 0.86),
        "roof": make_material("roof", (0.28, 0.32, 0.37), 0.90),
        "service": make_material("service", (0.075, 0.095, 0.12), 0.94),
        "admin": make_material("admin", (0.43, 0.49, 0.54), 0.88),
        "accent": make_material("accent", (0.12, 0.25, 0.32), 0.91),
    }
    objects = build_warehouse(materials)
    warehouse = join_and_finalize(objects)
    metrics = mesh_metrics(warehouse)

    if not 1500 <= metrics["triangles"] <= 5000:
        raise RuntimeError(
            f"Triangle count outside requested range: {metrics['triangles']}"
        )
    if max(metrics["dimensions"].x, metrics["dimensions"].y) > 50.01:
        raise RuntimeError(
            f"Horizontal footprint exceeds 50 m: {metrics['dimensions']}"
        )
    if not 19.5 <= metrics["dimensions"].z <= 20.5:
        raise RuntimeError(
            f"Height outside requested range: {metrics['dimensions'].z}"
        )
    if abs(metrics["minimum"].z) > 0.0001:
        raise RuntimeError(
            f"Warehouse is not grounded at Z=0: {metrics['minimum'].z}"
        )

    export_glb(warehouse)
    camera, _ground = configure_preview_scene(warehouse, materials)
    render_previews(camera)

    print(f"WAREHOUSE_OUTPUT {OUTPUT_PATH}")
    print(f"WAREHOUSE_FRONT_GLTF {FRONT_DIRECTION_GLTF}")
    print(
        "WAREHOUSE_METRICS "
        f"triangles={metrics['triangles']} "
        f"vertices={metrics['vertices']} "
        f"edges={metrics['edges']} "
        f"polygons={metrics['polygons']} "
        f"min={tuple(round(v, 5) for v in metrics['minimum'])} "
        f"max={tuple(round(v, 5) for v in metrics['maximum'])} "
        f"dimensions={tuple(round(v, 5) for v in metrics['dimensions'])}"
    )


if __name__ == "__main__":
    main()
