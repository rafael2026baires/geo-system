// public/js/map/map.adapter.maplibre.js
// Adapter MapLibre para GEO-SYSTEM / TwyBox
// Todavía NO activar desde map.adapter.js.

export function createLeafletMap(containerId, defaultLat, defaultLng) {
  return new maplibregl.Map({
    container: containerId,
    center: [defaultLng, defaultLat],
    zoom: 12,
    pitch: 45,
    bearing: 0,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap © CARTO'
        }
      },
      layers: [
        {
          id: 'osm-dark',
          type: 'raster',
          source: 'osm'
        }
      ]
    }
  });
}

export function createTileLayer(map) {
  // En MapLibre el tile base se define dentro del style.
  return null;
}

export function createMapPane(map, name, zIndex) {
  // Leaflet usa panes. MapLibre usa layers/sources.
  return null;
}

export function createLayerGroup(map) {
  // Placeholder: luego lo convertimos en colección propia de markers/capas.
  return {
    map,
    items: [],
    add(item) {
      this.items.push(item);
      return item;
    },
    removeLayer(item) {
      this.items = this.items.filter(x => x !== item);
      item?.remove?.();
    },
    clearLayers() {
      this.items.forEach(item => item?.remove?.());
      this.items = [];
    }
  };
}

// =========================================================
// CÁMARA / VIEWPORT
// =========================================================

export function getMapZoom(map) {
  return map.getZoom();
}

export function setMapZoom(map, zoom) {
  map.setZoom(zoom);
}

export function setMapMinZoom(map, zoom) {
  map.setMinZoom(zoom);
}

export function panMapTo(map, position) {
  map.jumpTo({
    center: [position.lng, position.lat],
    zoom: map.getZoom()
  });
}

export function flyToPosition(map, position, zoom) {
  map.flyTo({
    center: [position.lng, position.lat],
    zoom
  });
}

export function setMapCenter(map, position, zoom) {
  map.jumpTo({
    center: [position.lng, position.lat],
    zoom
  });
}

export function invalidateMapSize(map) {
  map.resize();
}

export function onMapZoom(map, callback) {
  map.on('zoom', callback);
}

export function onMapZoomEnd(map, callback) {
  map.on('zoomend', callback);
}

// =========================================================
// BOUNDS / CAPAS / CÍRCULOS
// =========================================================

export function createBoundsFromUnits(units) {
  const lngs = units.map(u => u.lng);
  const lats = units.map(u => u.lat);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
}

export function createBaseCircle(map, defaultLat, defaultLng, baseRadiusM) {
  // Pendiente: círculo base real con source/layer MapLibre.
  return null;
}

export function createMapCircle(layer, position, options) {
  // Pendiente: círculos cliente reales en MapLibre.
  return null;
}

export function createMapCircleMarker(layer, position, options) {
  // Pendiente: puntos cliente reales en MapLibre.
  return null;
}

export function clearLayerGroup(layerGroup) {
  layerGroup?.clearLayers?.();
}

export function removeLayerFromGroup(layerGroup, layer) {
  layerGroup?.removeLayer?.(layer);
}

export function removeMapLayer(map, layer) {
  layer?.remove?.();
}

// =========================================================
// MARKERS
// =========================================================

export function createDivIcon(options) {
  const el = document.createElement('div');

  el.className = options.className || '';
  el.innerHTML = options.html || '';

  el.style.width = `${options.iconSize?.[0] || 20}px`;
  el.style.height = `${options.iconSize?.[1] || 20}px`;

  return {
    element: el,
    iconSize: options.iconSize || [20, 20],
    iconAnchor: options.iconAnchor || [10, 10]
  };
}

export function createMapMarker(layer, position, options = {}) {
  const marker = new maplibregl.Marker({
    element: options.icon?.element,
    anchor: 'center'
  })
    .setLngLat([position.lng, position.lat])
    .addTo(layer.map);

  marker.__geoPosition = { lat: position.lat, lng: position.lng };
  marker.__geoElement = options.icon?.element || marker.getElement();

  layer.add(marker);

  return marker;
}

export function getMarkerPosition(marker) {
  return marker.__geoPosition || {
    lat: marker.getLngLat().lat,
    lng: marker.getLngLat().lng
  };
}

export function setMarkerPosition(marker, position) {
  marker.setLngLat([position.lng, position.lat]);
  marker.__geoPosition = { lat: position.lat, lng: position.lng };
}

export function setMarkerIcon(marker, icon) {
  const oldEl = marker.getElement();
  if (!oldEl || !icon?.element) return;

  oldEl.innerHTML = icon.element.innerHTML;
  oldEl.className = icon.element.className;
  marker.__geoElement = oldEl;
}

export function setMarkerOpacity(marker, opacity) {
  const el = marker.getElement();
  if (el) el.style.opacity = String(opacity);
}

export function getMarkerElement(marker) {
  return marker.getElement();
}