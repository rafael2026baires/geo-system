// public/js/map/map.style.overrides.js
// Overrides visuales del mapa base MapLibre.
// No toca markers, clientes, base ni seguimiento.

const LIBERTY_WARNING_FIXES = [
  { id: 'poi_r20', layout: { visibility: 'none' } },
  { id: 'poi_r7', layout: { visibility: 'none' } },
  { id: 'poi_r1', layout: { visibility: 'none' } },
  { id: 'poi_transit', layout: { visibility: 'none' } },
  { id: 'highway-shield-non-us', layout: { visibility: 'none' } },
  { id: 'highway-shield-us-interstate', layout: { visibility: 'none' } },
  { id: 'road_shield_us', layout: { visibility: 'none' } }
];

export const MAP_THEME_DEFAULT = {
  id: 'default',
  label: 'Default',
  layers: [
    ...LIBERTY_WARNING_FIXES
  ]
};

export const MAP_THEME_COMMERCIAL_DARK = {
  id: 'commercial-dark',
  label: 'Commercial Dark',
  layers: [

    // =====================================================
    // 1) FONDO GENERAL DEL MAPA
    // =====================================================
    { id: 'background', paint: { 'background-color': '#07111f' } },

    // =====================================================
    // 2) AGUA / MAR / RÍOS
    // =====================================================
    { id: 'water', paint: { 'fill-color': '#0b2a3a' } },
    { id: 'waterway_river', paint: { 'line-color': '#0e3a4f' } },
    { id: 'waterway_other', paint: { 'line-color': '#0e3a4f' } },

    // =====================================================
    // 3) VERDES / PARQUES / CÉSPED / BOSQUES
    // =====================================================
    { id: 'park', paint: { 'fill-color': '#183326' } },
    { id: 'park_outline', paint: { 'line-color': '#254d38' } },
    { id: 'landcover_grass', paint: { 'fill-color': '#183326' } },
    { id: 'landcover_wood', paint: { 'fill-color': '#12291d' } },
    { id: 'landuse_pitch', paint: { 'fill-color': '#1d3a2a' } },

    // =====================================================
    // 4) ZONAS URBANAS / RESIDENCIALES / SUELO
    // =====================================================
    { id: 'landuse_residential', paint: { 'fill-color': '#101927' } },
    { id: 'landuse_school', paint: { 'fill-color': '#182033' } },
    { id: 'landuse_hospital', paint: { 'fill-color': '#241824' } },
    { id: 'landuse_cemetery', paint: { 'fill-color': '#17261d' } },

    // =====================================================
    // 5) CALLES Y AVENIDAS - RELLENO INTERIOR
    // =====================================================
    { id: 'road_minor', paint: { 'line-color': '#333333' } },                 // calles chicas
    { id: 'road_secondary_tertiary', paint: { 'line-color': '#7c7c7c' } },    // avenidas / medianas
    { id: 'road_trunk_primary', paint: { 'line-color': '#7c7c7c' } },         // arterias grandes
    { id: 'road_motorway', paint: { 'line-color': '#7c7c7c' } },              // autopistas

    // =====================================================
    // 6) BORDES DE CALLES / CASING
    // =====================================================
    { id: 'road_minor_casing', paint: { 'line-color': '#1f2933' } },
    { id: 'road_secondary_tertiary_casing', paint: { 'line-color': '#2c3744' } },
    { id: 'road_trunk_primary_casing', paint: { 'line-color': '#344253' } },
    { id: 'road_motorway_casing', paint: { 'line-color': '#3b4b5f' } },

    // =====================================================
    // 7) PUENTES - SI APARECEN EN ZONA
    // =====================================================
    { id: 'bridge_street', paint: { 'line-color': '#6f6f6f' } },
    { id: 'bridge_secondary_tertiary', paint: { 'line-color': '#8a8a8a' } },
    { id: 'bridge_trunk_primary', paint: { 'line-color': '#9aa8ba' } },
    { id: 'bridge_motorway', paint: { 'line-color': '#b8d4ff' } },

    // =====================================================
    // 8) EDIFICIOS / CONSTRUCCIONES
    // =====================================================
    { id: 'building', paint: { 'fill-color': '#2f3b46' } },                  // huellas planas
    { id: 'building-3d', paint: { 'fill-extrusion-color': '#4b5563' } },     // volumen 3D

    // =====================================================
    // 9) NOMBRES DE CALLES
    // =====================================================
    { id: 'highway-name-path', paint: { 'text-color': '#8290a3' } },
    { id: 'highway-name-minor', paint: { 'text-color': '#9fb3c8' } },
    { id: 'highway-name-major', paint: { 'text-color': '#d6e4ff' } },

    // =====================================================
    // 10) ETIQUETAS DE ZONAS / BARRIOS / CIUDADES
    // =====================================================
    { id: 'label_other', paint: { 'text-color': '#9ca3af' } },
    { id: 'label_village', paint: { 'text-color': '#cbd5e1' } },
    { id: 'label_town', paint: { 'text-color': '#e5e7eb' } },
    { id: 'label_city', paint: { 'text-color': '#ffffff' } },
    { id: 'label_city_capital', paint: { 'text-color': '#ffffff' } },
    { id: 'label_state', paint: { 'text-color': '#cbd5e1' } },
    { id: 'label_country_1', paint: { 'text-color': '#ffffff' } },
    { id: 'label_country_2', paint: { 'text-color': '#e5e7eb' } },
    { id: 'label_country_3', paint: { 'text-color': '#cbd5e1' } },

    // =====================================================
    // 11) CAPAS OCULTAS PARA EVITAR WARNINGS DEL STYLE LIBERTY
    // =====================================================
    ...LIBERTY_WARNING_FIXES
  ]
};

//export const ACTIVE_MAP_THEME = MAP_THEME_DEFAULT;
export const ACTIVE_MAP_THEME = MAP_THEME_COMMERCIAL_DARK;

export function applyMapStyleOverrides(map, theme = ACTIVE_MAP_THEME) {
  if (!map || !theme?.layers) return;

  theme.layers.forEach(layerOverride => {
    const layerId = layerOverride.id;

    if (!map.getLayer(layerId)) return;

    if (layerOverride.paint) {
      Object.entries(layerOverride.paint).forEach(([key, value]) => {
        map.setPaintProperty(layerId, key, value);
      });
    }

    if (layerOverride.layout) {
      Object.entries(layerOverride.layout).forEach(([key, value]) => {
        map.setLayoutProperty(layerId, key, value);
      });
    }
  });
}