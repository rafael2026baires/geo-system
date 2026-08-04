"""Generate the isolated GeoSystem logistics truck refinement V3."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
V2_SCRIPT_PATH = SCRIPT_PATH.with_name("create_truck_logistics_v2.py")
OUTPUT_PATH = (
    PROJECT_ROOT
    / "public"
    / "assets"
    / "models"
    / "3d"
    / "truck_logistics_v3.glb"
)
EXPECTED_MATERIALS = {"body", "cabin", "wheel", "glass", "detail"}


def load_v2_generator():
    spec = spec_from_file_location("truck_logistics_v2_base", V2_SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load V2 generator: {V2_SCRIPT_PATH}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = load_v2_generator()
base.OUTPUT_PATH = OUTPUT_PATH

base_create_material = base.create_material
base_add_box = base.add_box
base_join_and_triangulate = base.join_and_triangulate


def create_material(name, color, roughness):
    refinements = {
        "body": ((0.12, 0.22, 0.29), 0.92),
        "cabin": ((0.60, 0.66, 0.69), 0.89),
        "wheel": ((0.012, 0.016, 0.020), 0.97),
        "glass": ((0.012, 0.040, 0.070), 0.88),
        "detail": ((0.042, 0.050, 0.055), 0.94),
    }
    refined_color, refined_roughness = refinements.get(
        name,
        (color, roughness),
    )
    return base_create_material(name, refined_color, refined_roughness)


def add_box(name, location, dimensions, material, bevel=0.0, segments=1):
    if name == "VisibleDarkChassis":
        # The lateral faces meet the inner wheel planes instead of floating
        # behind them. Its upper plane meets the cargo floor without overlap.
        location = (0.0, 0.0, 0.22)
        dimensions = (7.55, 2.00, 0.34)
    elif name == "FrontGrille":
        location = (3.765, 0.0, 1.21)
        dimensions = (0.085, 1.58, 0.54)
    elif name in {"LeftHeadlight", "RightHeadlight"}:
        side = -0.75 if name == "LeftHeadlight" else 0.75
        location = (3.812, side, 1.75)
        dimensions = (0.075, 0.38, 0.24)
    return base_add_box(
        name,
        location,
        dimensions,
        material,
        bevel,
        segments,
    )


def add_wheel(name, x, side, material):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16,
        radius=0.62,
        depth=0.36,
        end_fill_type="NGON",
        location=(x, side * 1.18, 0.62),
        rotation=(1.5707963267948966, 0.0, 0.0),
    )
    wheel = bpy.context.object
    wheel.name = name
    wheel.data.materials.append(material)
    base.apply_bevel(wheel, 0.07, 1)
    return wheel


def join_and_triangulate(objects, materials):
    truck = base_join_and_triangulate(objects, materials)
    truck.name = "TruckLogisticsV3"
    return truck


def validate_scene(truck):
    points = [truck.matrix_world @ vertex.co for vertex in truck.data.vertices]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    triangle_count = len(truck.data.loop_triangles)
    material_names = [material.name for material in truck.data.materials]

    if not 1000 <= triangle_count <= 1200:
        raise RuntimeError(
            f"V3 triangle count outside target range: {triangle_count}"
        )
    if set(material_names) != EXPECTED_MATERIALS:
        raise RuntimeError(f"Unexpected materials: {material_names}")
    if abs(minimum.z) > 1e-5:
        raise RuntimeError(f"Wheels are not grounded: min Z={minimum.z}")
    if abs((minimum.x + maximum.x) * 0.5) > 1e-5:
        raise RuntimeError("Longitudinal origin is not centered")
    if abs((minimum.y + maximum.y) * 0.5) > 1e-5:
        raise RuntimeError("Lateral origin is not centered")

    print(
        "TRUCK_V3_METRICS",
        {
            "triangles": triangle_count,
            "materials": material_names,
            "blender_bounds_min": tuple(round(value, 6) for value in minimum),
            "blender_bounds_max": tuple(round(value, 6) for value in maximum),
        },
    )


base.create_material = create_material
base.add_box = add_box
base.add_wheel = add_wheel
base.join_and_triangulate = join_and_triangulate
base.validate_scene = validate_scene


if __name__ == "__main__":
    base.main()
