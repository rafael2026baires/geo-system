// public/js/map/map.styles.js
// Catálogo único de estilos/base maps para Leaflet y MapLibre

export const MAP_STYLE_CARTO_DARK = {
  id: 'carto-dark',
  label: 'CARTO Dark',
  type: 'raster',
  leafletTiles: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  maplibreTiles: [
    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
  ],
  attribution: '© OpenStreetMap © CARTO'
};

export const MAP_STYLE_CARTO_LIGHT = {
  id: 'carto-light',
  label: 'CARTO Light',
  type: 'raster',
  leafletTiles: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  maplibreTiles: [
    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
  ],
  attribution: '© OpenStreetMap © CARTO'
};

export const MAP_STYLE_CARTO_VOYAGER = {
  id: 'carto-voyager',
  label: 'CARTO Voyager',
  type: 'raster',
  leafletTiles: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  maplibreTiles: [
    'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
  ],
  attribution: '© OpenStreetMap © CARTO'
};

export const MAP_STYLE_OPENFREEMAP_LIBERTY = {
  id: 'openfreemap-liberty',
  label: 'OpenFreeMap Liberty',
  type: 'maplibre-style',
  maplibreStyleUrl: 'https://tiles.openfreemap.org/styles/liberty'
};

// Estilo activo actual
export const ACTIVE_MAP_STYLE = MAP_STYLE_CARTO_DARK;