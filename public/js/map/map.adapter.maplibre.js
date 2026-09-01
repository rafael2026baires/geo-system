// public/js/map/map.adapter.maplibre.js
// Adapter MapLibre para GEO-SYSTEM / TwyBox
// Todavía NO activar desde map.adapter.js.

import { ACTIVE_MAP_STYLE, addCartoApiKey } from './map.styles.js';
import { applyMapStyleOverrides } from './map.style.overrides.js';
import { installMissingIconHandler } from './map.style.missing-icons.js';

export function createLeafletMap(containerId, defaultLat, defaultLng) {
  const map = new maplibregl.Map({  
    container: containerId,
    center: [defaultLng, defaultLat],
    zoom: 12,
    pitch: 55,
    maxPitch: 80,
    bearing: -18,
    attributionControl: {
      compact: false
    },
    canvasContextAttributes: {
      antialias: true
    },
    style: getMapLibreStyle()
  });
  installMissingIconHandler(map);
  map.addControl(new maplibregl.NavigationControl({
      showCompass: false
  }), 'top-right');

  map.on('style.load', () => {
    applyMapStyleOverrides(map);
  });

  return map; 

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

function getMapLibreStyle() {
  if (ACTIVE_MAP_STYLE.type === 'maplibre-style') {
    return ACTIVE_MAP_STYLE.maplibreStyleUrl;
  }

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: ACTIVE_MAP_STYLE.maplibreTiles.map(addCartoApiKey),
        tileSize: 256,
        attribution: ACTIVE_MAP_STYLE.attribution
      }
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap'
      }
    ]
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
  if (
    typeof map.isZooming === 'function' &&
    map.isZooming()
  ) {
    return;
  }

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


export function getMapBearing(map) {
  return map.getBearing();
}

export function getMapPitch(map) {
  return map.getPitch();
}

export function setMapBearing(map, bearing) {
  map.easeTo({
    bearing,
    duration: 400
  });
}

export function setMapPitch(map, pitch) {
  map.easeTo({
    pitch,
    duration: 400
  });
}

export function setMapCamera(map, options = {}) {
  map.easeTo({
    center: options.center,
    zoom: options.zoom,
    pitch: options.pitch,
    bearing: options.bearing,
    duration: options.duration ?? 500
  });
}

export function resetMapCamera(map) {
  map.easeTo({
    pitch: 55,
    bearing: -18,
    duration: 500
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

  return new maplibregl.LngLatBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  );
}

export function createBaseCircle(map, defaultLat, defaultLng, baseRadiusM, options = {}) {
  return createMapCircle(
    map,
    { lat: defaultLat, lng: defaultLng },
    {
      radius: baseRadiusM,
      color: getComputedStyle(document.documentElement)
        .getPropertyValue('--map-base-circle-border-color')
        .trim() || '#00e5ff',
      fillColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--map-base-circle-fill-color')
        .trim() || '#00e5ff',
      fillOpacity: 0.2,
      opacity: 0.4,
      weight: 2,
      beforeLayerId: options.beforeLayerId
    }
  );
}


export function createMapCircle(layer, position, options = {}) {
  const map = layer.map || layer;

  const id = `circle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sourceId = `${id}-source`;
  const fillLayerId = `${id}-fill`;
  const lineLayerId = `${id}-line`;

  const radiusMeters = options.radius || 80;
  const points = 64;

  const coords = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;

    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const lng = position.lng + (dx / (111320 * Math.cos(position.lat * Math.PI / 180)));
    const lat = position.lat + (dy / 110540);

    coords.push([lng, lat]);
  }

  const feature = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    properties: {}
  };

  function add() {
    if (map.getSource(sourceId)) return;

    map.addSource(sourceId, {
      type: 'geojson',
      data: feature
    });

    const fillLayerDefinition = {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': options.fillColor || options.color || '#00e5ff',
        'fill-opacity': options.fillOpacity ?? 0.12
      }
    };

    const lineLayerDefinition = {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': options.color || '#00e5ff',
        'line-width': options.weight || 1,
        'line-opacity': options.opacity ?? 0.7
      }
    };

    const beforeLayerId =
      options.beforeLayerId && map.getLayer(options.beforeLayerId)
        ? options.beforeLayerId
        : null;

    if (beforeLayerId) {
      map.addLayer(fillLayerDefinition, beforeLayerId);
      map.addLayer(lineLayerDefinition, beforeLayerId);
      return;
    }

    map.addLayer(fillLayerDefinition);
    map.addLayer(lineLayerDefinition);
  }

  const item = {
    remove() {
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  };

  if (map.loaded()) {
    add();
  } else {
    map.once('load', add);
  }

  if (typeof layer.add === 'function') {
    layer.add(item);
  }

  return item;
}

export function createMapCircleMarker(layer, position, options = {}) {
  const map = layer.map || layer;

  const id = `circle-marker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sourceId = `${id}-source`;
  const layerId = `${id}-layer`;

  const feature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [position.lng, position.lat]
    },
    properties: {}
  };

  function add() {
    if (map.getSource(sourceId)) return;

    map.addSource(sourceId, {
      type: 'geojson',
      data: feature
    });

    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': options.radius || 5,
        'circle-color': options.fillColor || options.color || '#00e5ff',
        'circle-opacity': options.fillOpacity ?? 0.9,
        'circle-stroke-color': options.color || '#ffffff',
        'circle-stroke-width': options.weight || 1,
        'circle-stroke-opacity': options.opacity ?? 0.8
      }
    });
  }

  const item = {
    remove() {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  };

  if (map.loaded()) {
    add();
  } else {
    map.once('load', add);
  }

  if (typeof layer.add === 'function') {
    layer.add(item);
  }

  return item;
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

export function createMapMarker(layerOrMap, position, options = {}) {
  const targetMap = layerOrMap.map || layerOrMap;

  const marker = new maplibregl.Marker({
    element: options.icon?.element,
    anchor: 'center'
  })
    .setLngLat([position.lng, position.lat])
    .addTo(targetMap);

  marker.__geoPosition = { lat: position.lat, lng: position.lng };
  marker.__geoElement = options.icon?.element || marker.getElement();

  if (typeof layerOrMap.add === 'function') {
    layerOrMap.add(marker);
  }

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
  const el = marker.getElement();
  if (!el || !icon?.element) return;

  el.innerHTML = icon.element.innerHTML;
  el.className = icon.element.className;

  el.style.width = `${icon.iconSize?.[0] || 20}px`;
  el.style.height = `${icon.iconSize?.[1] || 20}px`;

  const innerImg = el.querySelector('.veh-img');
  if (innerImg) {
    innerImg.style.width = '100%';
    innerImg.style.height = '100%';
  }

  marker.__geoElement = el;
}

export function setMarkerOpacity(marker, opacity) {
  const el = marker.getElement();
  if (el) el.style.opacity = String(opacity);
}

export function getMarkerElement(marker) {
  return marker.getElement();
}
