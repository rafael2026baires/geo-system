// public/js/map/map.style.overrides.js
// Overrides visuales del mapa base MapLibre.
// No toca markers, clientes, base ni seguimiento.

export const MAP_THEME_DEFAULT = {
  id: 'default',
  label: 'Default',
  layers: []
};

export const MAP_THEME_COMMERCIAL_DARK = {
  id: 'commercial-dark',
  label: 'Commercial Dark',
  layers: [
    // Acá luego agregamos cambios reales por layer:
    // { id: 'background', paint: { 'background-color': '#0b1220' } }
  ]
};

export const ACTIVE_MAP_THEME = MAP_THEME_DEFAULT;

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