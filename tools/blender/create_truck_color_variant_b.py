"""Generate GeoSystem truck color variant B."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


BASE_SCRIPT = Path(__file__).with_name("create_truck_color_variant_a.py")
spec = spec_from_file_location("truck_color_variant_generator", BASE_SCRIPT)
generator = module_from_spec(spec)
spec.loader.exec_module(generator)

VARIANT_B = {
    "box": ((0.40, 0.48, 0.55), 0.88),
    "cabin": ((0.64, 0.68, 0.72), 0.86),
    "glass": ((0.055, 0.095, 0.135), 0.91),
    "wheels": ((0.022, 0.028, 0.035), 0.92),
    "details": ((0.060, 0.078, 0.098), 0.92),
    "lights": ((0.72, 0.75, 0.76), 0.86),
}


if __name__ == "__main__":
    generator.generate_variant("b", VARIANT_B)
