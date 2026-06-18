// public/js/map/map.clients.js
// Clientes en MapLibre: source único + layers fijas.
// No borrar/redibujar layers en cada zoom.

const CLIENTS_SOURCE_ID = 'geo-clients-source';
const CLIENT_RADIUS_FILL_LAYER_ID = 'geo-clients-radius-fill';
const CLIENT_RADIUS_LINE_LAYER_ID = 'geo-clients-radius-line';
const CLIENT_POINTS_LAYER_ID = 'geo-clients-points';

const CLIENT_RADIUS_METERS = 70;

let clientsMap = null;
let clientsLayersReady = false;
let pendingFeatureCollection = null;

function hasValidClientPosition(client) {
  return client.lat != null && client.lng != null;
}

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

function createCirclePolygon(lng, lat, radiusMeters, points = 64) {
  const coords = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;

    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const pointLng = lng + (dx / (111320 * Math.cos(lat * Math.PI / 180)));
    const pointLat = lat + (dy / 110540);

    coords.push([pointLng, pointLat]);
  }

  return coords;
}

function buildClientsFeatureCollection(data) {
  const rootStyles = getComputedStyle(document.documentElement);

  const radiusColor = getCssVar('--map-client-circle-color', '#00e5ff');
  const doneColor = getCssVar('--map-client-done-color', '#22c55e');
  const pendingColor = getCssVar('--map-client-pending-color', '#f97316');

  const features = [];

  data.units.forEach(unit => {
    if (unit.active !== 1) return;
    if (!unit.clients || unit.clients.length === 0) return;

    unit.clients.forEach(client => {
      if (!hasValidClientPosition(client)) return;

      const lat = client.lat;
      const lng = client.lng;
      const status = client.status;
      const pointColor = status === 40 ? doneColor : pendingColor;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            createCirclePolygon(lng, lat, CLIENT_RADIUS_METERS)
          ]
        },
        properties: {
          kind: 'radius',
          color: radiusColor
        }
      });

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          kind: 'point',
          color: pointColor
        }
      });
    });
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

function ensureClientsLayers(map) {
  if (clientsLayersReady) return;
  if (!map || typeof map.getSource !== 'function') return;

  if (!map.loaded()) {
    map.once('load', () => {
      ensureClientsLayers(map);

      if (pendingFeatureCollection) {
        updateClientsSource(map, pendingFeatureCollection);
        pendingFeatureCollection = null;
      }
    });

    return;
  }

  if (!map.getSource(CLIENTS_SOURCE_ID)) {
    map.addSource(CLIENTS_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
  }

  if (!map.getLayer(CLIENT_RADIUS_FILL_LAYER_ID)) {
    map.addLayer({
      id: CLIENT_RADIUS_FILL_LAYER_ID,
      type: 'fill',
      source: CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'radius'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.2
      }
    });
  }

  if (!map.getLayer(CLIENT_RADIUS_LINE_LAYER_ID)) {
    map.addLayer({
      id: CLIENT_RADIUS_LINE_LAYER_ID,
      type: 'line',
      source: CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'radius'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 0.5,
        'line-opacity': 0.4
      }
    });
  }

  if (!map.getLayer(CLIENT_POINTS_LAYER_ID)) {
    map.addLayer({
      id: CLIENT_POINTS_LAYER_ID,
      type: 'circle',
      source: CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'point'],
      paint: {
        'circle-radius': 2,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.7,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.8
      }
    });
  }

  clientsLayersReady = true;
}

function updateClientsSource(map, featureCollection) {
  const source = map.getSource(CLIENTS_SOURCE_ID);

  if (!source) {
    pendingFeatureCollection = featureCollection;
    return;
  }

  source.setData(featureCollection);
}

export function renderClients(map, data) {
  clientsMap = map;

  if (!clientsMap || !data?.units) return;

  const featureCollection = buildClientsFeatureCollection(data);

  ensureClientsLayers(clientsMap);

  if (!clientsLayersReady) {
    pendingFeatureCollection = featureCollection;
    return;
  }

  updateClientsSource(clientsMap, featureCollection);
}