// public/js/map/markers/vehicle.marker.symbol.js
// Implementación experimental futura de markers con MapLibre Symbol Layer.
// No está activa.

const VEHICLE_SYMBOL_SOURCE_ID = 'geo-vehicle-symbol-source';
const VEHICLE_SYMBOL_LAYER_ID = 'geo-vehicle-symbol-layer';
const VEHICLE_SYMBOL_HALO_LAYER_ID = 'geo-vehicle-symbol-halo-layer';

const vehicleSymbolFeaturesByMap = new WeakMap();

function getVehicleSymbolFeatureStore(map) {
  if (!vehicleSymbolFeaturesByMap.has(map)) {
    vehicleSymbolFeaturesByMap.set(map, new Map());
  }

  return vehicleSymbolFeaturesByMap.get(map);
}

const VEHICLE_TRUCK_IMAGE_ID = 'vehicle-truck';
const VEHICLE_DOT_IMAGE_ID = 'vehicle-dot';

function ensureVehicleSymbolImages(map) {
  if (!map) return;

  if (!map.hasImage(VEHICLE_DOT_IMAGE_ID)) {
    const dot = document.createElement('canvas');
    dot.width = 32;
    dot.height = 32;

    const ctx = dot.getContext('2d');
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    map.addImage( VEHICLE_DOT_IMAGE_ID, ctx.getImageData(0, 0, 32, 32));
  }

  if (!map.hasImage(VEHICLE_TRUCK_IMAGE_ID)) {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(VEHICLE_TRUCK_IMAGE_ID)) {
        map.addImage(VEHICLE_TRUCK_IMAGE_ID, img);
        refreshVehicleSymbolSource(map);
      }
    };
    img.src = '/assets/images/truck1.png';
    //img.src = '/assets/images/truck-isometric.png';
  }
}

export function ensureVehicleSymbolLayer(map) {
  if (!map) return;

  console.log('[SYMBOL-ENSURE]', {
  loaded: typeof map.loaded === 'function' ? map.loaded() : null,
  styleLoaded: typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : null,
  hasSource: !!map.getSource?.(VEHICLE_SYMBOL_SOURCE_ID)
});

    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
    setTimeout(() => {
        ensureVehicleSymbolLayer(map);
        refreshVehicleSymbolSource(map);
    }, 100);
    return;
    }

  ensureVehicleSymbolImages(map);

  if (!map.getSource(VEHICLE_SYMBOL_SOURCE_ID)) {
    map.addSource(VEHICLE_SYMBOL_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
  }

  if (!map.getLayer(VEHICLE_SYMBOL_HALO_LAYER_ID)) {
    map.addLayer({
        id: VEHICLE_SYMBOL_HALO_LAYER_ID,
        type: 'circle',
        source: VEHICLE_SYMBOL_SOURCE_ID,
        filter: ['==', ['get', 'highlighted'], true],
        paint: {
        'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12, 14,
            15, 18,
            18, 26
        ],        
        'circle-color': '#ffffff',
        'circle-opacity': 0.4,
        'circle-stroke-width': 0,
        'circle-stroke-opacity': 0.2
        }
    });
  }  

  if (!map.getLayer(VEHICLE_SYMBOL_LAYER_ID)) {
    map.addLayer({
      id: VEHICLE_SYMBOL_LAYER_ID,
      type: 'symbol',
      source: VEHICLE_SYMBOL_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['get', 'size'],
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      },
      paint: {
        'icon-opacity': ['get', 'opacity']
      }
    });
  } 

}

function buildEmptyVehicleFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: []
  };
}

function buildVehicleFeature(id, position, options = {}) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [position.lng, position.lat]
    },
    properties: {
      id,
      icon: options.icon || 'vehicle-truck',
      size: options.size || 1,
      bearing: options.bearing || 0,
      opacity: options.opacity ?? 1,
      highlighted: options.highlighted === true
    }
  };
}

function getVehicleSymbolSource(map) {
  if (!map) return null;
  return map.getSource(VEHICLE_SYMBOL_SOURCE_ID) || null;
}

function setVehicleSymbolData(map, featureCollection) {
  const source = getVehicleSymbolSource(map);

  console.log('[SYMBOL-SOURCE]', !!source, featureCollection?.features?.length);

  if (!source) return;

  source.setData(featureCollection || buildEmptyVehicleFeatureCollection());
}

function refreshVehicleSymbolSource(map) {
  setVehicleSymbolData(map, {
    type: 'FeatureCollection',
    features: Array.from(getVehicleSymbolFeatureStore(map).values())
  });
}

export function createVehicleSymbolMarker(map, id, position, options = {}) {
  ensureVehicleSymbolLayer(map);

  const feature = buildVehicleFeature(id, position, options);
  getVehicleSymbolFeatureStore(map).set(id, feature);

  console.log('[SYMBOL-MARKER-CREATED]', id, position, getVehicleSymbolFeatureStore(map).size);

  setTimeout(() => {
    refreshVehicleSymbolSource(map);
  }, 0);

  return {
    __type: 'symbol',
    __id: id,
    __map: map
  };
}

export function setVehicleSymbolMarkerPosition(marker, position) {
  if (!marker || marker.__type !== 'symbol') return;

  const feature = getVehicleSymbolFeatureStore(marker.__map).get(marker.__id);
  if (!feature) return;

  feature.geometry.coordinates = [position.lng, position.lat];

  refreshVehicleSymbolSource(marker.__map);
}

export function getVehicleSymbolMarkerPosition(marker) {
  if (!marker || marker.__type !== 'symbol') return null;

  const feature = getVehicleSymbolFeatureStore(marker.__map).get(marker.__id);
  if (!feature) return null;

  const [lng, lat] = feature.geometry.coordinates;

  return { lat, lng };
}

export function setVehicleSymbolMarkerBearing(marker, deg) {
  if (!marker || marker.__type !== 'symbol') return;

  const feature = getVehicleSymbolFeatureStore(marker.__map).get(marker.__id);
  if (!feature) return;

  feature.properties.bearing = deg;

  refreshVehicleSymbolSource(marker.__map);
}

export function setVehicleSymbolMarkerOpacity(marker, opacity) {
  if (!marker || marker.__type !== 'symbol') return;

  const feature = getVehicleSymbolFeatureStore(marker.__map).get(marker.__id);
  if (!feature) return;

  feature.properties.opacity = opacity;

  refreshVehicleSymbolSource(marker.__map);
}

export function setVehicleSymbolMarkerHighlighted(marker, highlighted) {
  if (!marker || marker.__type !== 'symbol') return;

  const feature = getVehicleSymbolFeatureStore(marker.__map).get(marker.__id);
  if (!feature) return;

  feature.properties.highlighted = highlighted === true;

  refreshVehicleSymbolSource(marker.__map);
}

export function updateVehicleSymbolMarkerVisualByZoom(marker, zoom) {
  if (!marker || marker.__type !== 'symbol') return;

  const feature = getVehicleSymbolFeatureStore(marker.__map).get(marker.__id);
  if (!feature) return;

  if (zoom < 13) {
    feature.properties.icon = 'vehicle-dot';
    feature.properties.size = 0.18;
  } else if (zoom < 15) {
    feature.properties.icon = 'vehicle-truck';
    feature.properties.size = 0.22;
  } else if (zoom < 16) {
    feature.properties.icon = 'vehicle-truck';
    feature.properties.size = 0.26;
  } else if (zoom < 18) {
    feature.properties.icon = 'vehicle-truck';
    feature.properties.size = 0.34;
  } else {
    feature.properties.icon = 'vehicle-truck';
    feature.properties.size = 0.42;
  }

  refreshVehicleSymbolSource(marker.__map);
}

export function removeVehicleSymbolMarker(marker) {
  if (!marker || marker.__type !== 'symbol') return;

  getVehicleSymbolFeatureStore(marker.__map).delete(marker.__id);

  refreshVehicleSymbolSource(marker.__map);
}