import { createClientMarkers3DLayer } from './client.marker.3d.js';
import {
  FLOATING_MAP_LOCATION_SCALE_PROFILE
} from './map.3d.scale.config.js';

const FLOATING_CLIENT_MARKERS_3D_LAYER_ID =
  'floating-client-markers-3d-layer';

const floatingClientMarkers3DStates = new WeakMap();

function isCompatibleMap(map) {
  return Boolean(
    map &&
    typeof map.addLayer === 'function' &&
    typeof map.getLayer === 'function' &&
    typeof map.removeLayer === 'function' &&
    typeof map.loaded === 'function' &&
    typeof map.isStyleLoaded === 'function' &&
    typeof map.getCanvas === 'function' &&
    typeof map.triggerRepaint === 'function' &&
    typeof map.on === 'function' &&
    typeof map.off === 'function' &&
    globalThis.maplibregl?.MercatorCoordinate
  );
}

export function initFloatingClientMarkers3D(map) {
  if (!isCompatibleMap(map)) {
    console.warn('[FloatingClientMarkers3D] Se requiere un mapa compatible con MapLibre.');
    return null;
  }

  const existingState = floatingClientMarkers3DStates.get(map);
  if (existingState) {
    existingState.addLayerWhenReady();
    return existingState.layer;
  }

  const layer = createClientMarkers3DLayer({
    id: FLOATING_CLIENT_MARKERS_3D_LAYER_ID,
    zoomScaleProfile: FLOATING_MAP_LOCATION_SCALE_PROFILE
  });
  const pendingClients = [];
  layer.setClients(pendingClients);

  const addLayerWhenReady = () => {
    const state = floatingClientMarkers3DStates.get(map);
    if (state?.layer !== layer) return;
    if ((!map.loaded() && !map.isStyleLoaded()) || map.getLayer(layer.id)) return;

    const vehicleLayerId = 'floating-vehicle-marker-3d-layer';
    const beforeId = map.getLayer(vehicleLayerId)
      ? vehicleLayerId
      : undefined;

    if (beforeId) {
      map.addLayer(layer, beforeId);
    } else {
      map.addLayer(layer);
    }

    layer.setClients(state.pendingClients);
    map.triggerRepaint();
  };

  floatingClientMarkers3DStates.set(map, {
    layer,
    pendingClients,
    addLayerWhenReady
  });

  map.on('load', addLayerWhenReady);
  map.on('style.load', addLayerWhenReady);
  addLayerWhenReady();

  return layer;
}

export function updateFloatingClientMarkers3D(map, clients) {
  if (!Array.isArray(clients)) {
    throw new TypeError('updateFloatingClientMarkers3D requiere un array.');
  }

  const layer = initFloatingClientMarkers3D(map);
  if (!layer) return false;

  const state = floatingClientMarkers3DStates.get(map);
  state.pendingClients = [...clients];
  layer.setClients(state.pendingClients);
  state.addLayerWhenReady();
  map.triggerRepaint();

  return true;
}

export function clearFloatingClientMarkers3D(map) {
  const state = floatingClientMarkers3DStates.get(map);
  if (!state) return false;

  state.pendingClients = [];
  state.layer.setClients([]);
  map.triggerRepaint();

  return true;
}

export function destroyFloatingClientMarkers3D(map) {
  const state = floatingClientMarkers3DStates.get(map);
  if (!state) return false;

  map.off('load', state.addLayerWhenReady);
  map.off('style.load', state.addLayerWhenReady);

  if (map.getLayer?.(state.layer.id)) {
    map.removeLayer(state.layer.id);
  }

  floatingClientMarkers3DStates.delete(map);
  return true;
}
