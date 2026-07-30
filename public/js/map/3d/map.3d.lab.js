import { createClientMarkers3DLayer } from './client.marker.3d.js';
import { MAIN_MAP_LOCATION_SCALE_PROFILE } from './map.3d.scale.config.js';
import { setLocationInfoLabels } from '../labels/location.info.labels.js';

const LAYER_ID = 'map-3d-lab-client-marker';
const labStates = new WeakMap();

function isMapLibreMap(map) {
  return Boolean(
    map &&
    typeof map.addLayer === 'function' &&
    typeof map.getLayer === 'function' &&
    typeof map.removeLayer === 'function' &&
    typeof map.loaded === 'function' &&
    typeof map.isStyleLoaded === 'function' &&
    typeof map.getCanvas === 'function' &&
    typeof map.on === 'function' &&
    typeof map.off === 'function' &&
    globalThis.maplibregl?.MercatorCoordinate
  );
}

export function initMap3DLab(map, options = {}) {
  const {
    enabled = true
  } = options;

  if (!enabled) {
    destroyMap3DLab(map);
    return null;
  }

  if (!isMapLibreMap(map)) {
    console.warn('[Map3DLab] Se requiere una instancia compatible con MapLibre.');
    return null;
  }

  const existingState = labStates.get(map);
  if (existingState) return existingState.layer;

  const layer = createClientMarkers3DLayer({
    id: LAYER_ID,

    // **************  MAPA PRINCIPAL donde calibro en el zoon el tamaño de los locations ******************
    // Calibración visual del location GLB del mapa principal.
    zoomScaleProfile: MAIN_MAP_LOCATION_SCALE_PROFILE
    // ******************************************************************************************************
  });
  const initialClients = [];
  layer.setClients(initialClients);

  const addLayerWhenReady = () => {
    const state = labStates.get(map);
    if (state?.layer !== layer) return;
    if ((!map.loaded() && !map.isStyleLoaded()) || map.getLayer(LAYER_ID)) return;
    const vehicleLayerId = 'geo-vehicle-symbol-layer';

    if (map.getLayer(vehicleLayerId)) {
      map.addLayer(layer, vehicleLayerId);
    } else {
      map.addLayer(layer);
    }
    layer.setClients(state.pendingClients);
    map.triggerRepaint();
  };

  labStates.set(map, { layer, addLayerWhenReady, pendingClients: initialClients });
  map.on('load', addLayerWhenReady);
  map.on('style.load', addLayerWhenReady);
  addLayerWhenReady();

  return layer;
}

export function updateMap3DClients(map, data) {
  const state = labStates.get(map);
  if (!state) return false;

  const clients = [];

  if (Array.isArray(data?.units)) {
    data.units.forEach(unit => {
      if (unit.active !== 1) return;
      if (!Array.isArray(unit.clients)) return;

      unit.clients.forEach(client => {
        if (
          client.lat === null ||
          client.lat === undefined ||
          String(client.lat).trim() === '' ||
          client.lng === null ||
          client.lng === undefined ||
          String(client.lng).trim() === ''
        ) {
          return;
        }

        const lat = Number(client.lat);
        const lng = Number(client.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        clients.push({
          unit_id: unit.unit_id,
          order_id: client.order_id,
          customer_name: client.customer_name,
          customer_id: client.customer_id,
          status: client.status,
          lat,
          lng
        });
      });
    });
  }

  state.pendingClients = clients;
  setLocationInfoLabels(map, clients);

  if (map.getLayer?.(state.layer.id)) {
    state.layer.setClients(clients);
  }

  return true;
}

export function destroyMap3DLab(map) {
  if (!map) return false;

  const state = labStates.get(map);
  if (!state) return false;

  map.off('load', state.addLayerWhenReady);
  map.off('style.load', state.addLayerWhenReady);

  if (map.getLayer?.(state.layer.id)) {
    map.removeLayer(state.layer.id);
  }

  labStates.delete(map);
  return true;
}
