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

export function getMarkerPosition(marker) {
  return marker.getLatLng();
}

export function flyToPosition(map, position, zoom) {
  map.flyTo(position, zoom);
}

export function setMapCenter(map, position, zoom) {
  map.setView(position, zoom, { animate: false });
}

export function getMapZoom(map) {
  return map.getZoom();
}

export function invalidateMapSize(map) {
  map.invalidateSize();
}

export function setMapZoom(map, zoom) {
  map.setZoom(zoom);
}

export function setMapMinZoom(map, zoom) {
  map.setMinZoom(zoom);
}

export function panMapTo(map, position) {
  map.panTo(position, { animate: false });
}

export function removeMapLayer(map, layer) {
  map.removeLayer(layer);
}

export function setMarkerPosition(marker, position) {
  marker.setLatLng([position.lat, position.lng]);
}

export function setMarkerIcon(marker, icon) {
  marker.setIcon(icon);
}

export function getMarkerElement(marker) {
  return marker.getElement();
} 

export function createDivIcon(options) {
  return L.divIcon(options);
}

export function createMapMarker(layer, position, options = {}) {
  return L.marker([position.lat, position.lng], options).addTo(layer);
}

export function onMapZoomEnd(map, callback) {
  map.on('zoomend', callback);
}