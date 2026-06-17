// public/js/map/map.adapter.leaflet.js

export function createLeafletMap(containerId, defaultLat, defaultLng) {
  const map = L.map(containerId).setView([defaultLat, defaultLng], 12);

  map.options.zoomSnap = 0.5;
  map.options.zoomDelta = 0.5;

  return map;
}

export function createTileLayer(map) {
  const baseLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '© OpenStreetMap © CARTO',
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2
    }
  );

  baseLayer.addTo(map);
  return baseLayer;
}

export function createLayerGroup(map) {
  return L.layerGroup().addTo(map);
}

export function createMapPane(map, name, zIndex) {
  map.createPane(name);
  map.getPane(name).style.zIndex = zIndex;
}

export function createBaseCircle(map, defaultLat, defaultLng, baseRadiusM) {
  return L.circle([defaultLat, defaultLng], {
    pane: 'circlePane',
    radius: baseRadiusM,
    color: getComputedStyle(document.documentElement)
      .getPropertyValue('--map-base-circle-border-color')
      .trim(),
    fillColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--map-base-circle-fill-color')
      .trim(),
    fillOpacity: 0.7
  }).addTo(map);
}

export function createBoundsFromUnits(units) {
  return L.latLngBounds(units.map(u => [u.lat, u.lng]));
}