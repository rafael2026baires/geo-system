# Herramientas de modelos 3D

`tools/` contiene utilidades manuales de desarrollo para inspeccionar, optimizar, generar y renderizar modelos 3D. No forma parte del runtime productivo de GEO-SYSTEM: ningún PHP, HTML, JavaScript o CSS carga ni ejecuta estos scripts.

## Requisitos

- Python para la sintaxis y módulos de biblioteca estándar.
- Python incluido con Blender para ejecutar las operaciones 3D.
- Módulos de Blender según el script: `bpy`, `bmesh` y `mathutils`.

No se declaran ni instalan dependencias desde esta carpeta. Ejecutar los scripts manualmente con una versión compatible de Blender y revisar primero todas las rutas, entradas y salidas.

## Estructura

- `optimize_isuzu_elf_2024_v1.py`: utilidad parametrizada para inspeccionar, optimizar, validar o renderizar un GLB. Recibe `--mode`, `--input`, `--report` y, para optimización/render, `--output`. Puede escribir un GLB optimizado, un render y reportes JSON en las rutas suministradas.
- `blender/`: generadores y transformadores específicos ejecutados mediante Blender Python.

## Scripts Blender

| Script | Función aparente | Entrada | Salida esperada |
|---|---|---|---|
| `create_low_poly_truck_smooth_box_v1.py` | Suaviza/modifica overlays de la caja de un camión base. | `public/assets/models/3d/low_poly_truck.glb` | `public/assets/models/3d/low_poly_truck_smooth_box_v1.glb` |
| `create_low_poly_truck_smooth_box_cabin_test_v1.py` | Genera una prueba con cabina 30 % más alta. | `low_poly_truck_smooth_box_v1.glb` | `low_poly_truck_smooth_box_cabin_test_v1.glb` y métricas impresas/JSON internas |
| `create_low_poly_truck_smooth_box_cabin_box_test_v1.py` | Baja la caja de la variante de cabina validada. | `low_poly_truck_smooth_box_cabin_test_v1.glb` | `low_poly_truck_smooth_box_cabin_box_test_v1.glb` y métricas impresas/JSON internas |
| `create_truck_color_variant_a.py` | Genera la variante cromática A y renders de revisión. | `low_poly_truck_smooth_box_cabin_box_test_v1.glb` | `low_poly_truck_variant_a.glb` y PNG en `public/assets/models/3d/preview/` |
| `create_truck_color_variant_b.py` | Reutiliza el generador A con la paleta B. | script A y el mismo GLB fuente | `low_poly_truck_variant_b.glb` y previews |
| `create_truck_color_variant_c.py` | Reutiliza el generador A con la paleta C. | script A y el mismo GLB fuente | `low_poly_truck_variant_c.glb` y previews |
| `create_truck_logistics_v1.py` | Construye un camión logístico low-poly V1 desde geometría Blender. | sin GLB de entrada | `public/assets/models/3d/truck_logistics_v1.glb` |
| `create_truck_logistics_v2.py` | Construye la prueba visual logística V2. | sin GLB de entrada | `public/assets/models/3d/truck_logistics_v2.glb` |
| `create_truck_logistics_v3.py` | Refina V2 reutilizando su generador. | `create_truck_logistics_v2.py` | `public/assets/models/3d/truck_logistics_v3.glb` |
| `create_truck_operational_marker_v1.py` | Construye un marker 3D operativo y renders de revisión. | sin GLB de entrada | `truck_operational_marker_v1.glb` y PNG en `preview/` |
| `create_truck_visual_v1.py` | Construye un camión visual low-poly y renders de revisión. | sin GLB de entrada | `truck_visual_v1.glb` y PNG en `preview/` |
| `create_warehouse_original.py` | Construye el depósito 3D y cuatro renders de revisión. | sin GLB de entrada | `warehouse.glb` y PNG en `preview/` |

## Advertencias operativas

- Varios scripts escriben directamente dentro de `public/assets/models/3d/` y pueden reemplazar o recrear assets. Revisar las rutas y conservar respaldos antes de ejecutarlos.
- `create_warehouse_original.py` contiene la ruta absoluta local `C:\xampp\htdocs\apps\geo-system`; debe revisarse antes de usarlo en otra máquina o ubicación.
- Las entradas históricas del pipeline `low_poly_truck*` pueden no existir actualmente dentro del proyecto porque los GLB no productivos se archivaron externamente. Restaurar conscientemente la entrada necesaria a una ubicación revisada antes de ejecutar; no cambiar rutas ni copiar assets de forma automática.
- Los scripts deben ejecutarse manualmente. No incorporarlos al arranque, build o runtime productivo sin una decisión explícita.
- Revisar visualmente y validar hashes de cualquier resultado antes de considerarlo utilizable.
- Los GLB, renders, previews y reportes generados no deben agregarse automáticamente a Git. Evaluarlos individualmente.

## Archivos ignorados

La configuración actual de `.gitignore` cubre:

- `tools/**/__pycache__/`;
- `*.py[cod]`;
- `public/assets/models/3d/preview/`.

Por lo tanto, caches `__pycache__`, bytecode `.pyc`/`.pyo` y previews permanecen fuera de Git. Este `README.md` se versiona mediante la excepción específica `!tools/README.md` definida en `.gitignore`.
