// public/js/map/markers/vehicle.marker.js
// Fachada pública de markers de vehículos.

const VEHICLE_MARKER_ENGINE = 'symbol'; // dom | symbol
//const VEHICLE_MARKER_ENGINE = 'dom';

import {
  createVehicleDomMarker,
  updateVehicleMarkerVisualByZoom as updateVehicleDomMarkerVisualByZoom,
  setVehicleMarkerBearing as setVehicleDomMarkerBearing,
  setVehicleMarkerHighlighted as setVehicleDomMarkerHighlighted
} from './vehicle.marker.dom.js';

import {
  createVehicleSymbolMarker,
  getVehicleSymbolMarkerPosition,
  setVehicleSymbolMarkerPosition,
  setVehicleSymbolMarkerOpacity,
  setVehicleSymbolMarkerBearing,
  setVehicleSymbolMarkerHighlighted,
  updateVehicleSymbolMarkerVisualByZoom,
  removeVehicleSymbolMarker
} from './vehicle.marker.symbol.js';

import {
  getMarkerPosition,
  setMarkerPosition,
  setMarkerOpacity,
  removeLayerFromGroup,
  removeMapLayer
} from '../map.adapter.js';

export function createVehicleMarker(layerOrMap, position, zoom = 13, options = {}) {
  if (VEHICLE_MARKER_ENGINE === 'symbol') {
    const map = layerOrMap.map || layerOrMap;
    const id = options.id || `vehicle-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return createVehicleSymbolMarker(map, id, position, {
      icon: zoom < 13 ? 'vehicle-dot' : 'vehicle-truck',      
      size: zoom < 13 ? 0.18 : zoom < 15 ? 0.22 : zoom < 16 ? 0.26 : zoom < 18 ? 0.34 : 0.42,
      bearing: 0,
      opacity: 1,
      highlighted: false
    });
  }

  return createVehicleDomMarker(layerOrMap, position, zoom, options);
}

export function getVehicleMarkerPosition(marker) {
  if (marker?.__type === 'symbol') {
    return getVehicleSymbolMarkerPosition(marker);
  }

  return getMarkerPosition(marker);
}

export function setVehicleMarkerPosition(marker, position) {
  if (marker?.__type === 'symbol') {
    setVehicleSymbolMarkerPosition(marker, position);
    return;
  }

  setMarkerPosition(marker, position);
}

export function setVehicleMarkerOpacity(marker, opacity) {
  if (marker?.__type === 'symbol') {
    setVehicleSymbolMarkerOpacity(marker, opacity);
    return;
  }

  setMarkerOpacity(marker, opacity);
}

export function setVehicleMarkerBearing(marker, deg) {
  if (marker?.__type === 'symbol') {
    setVehicleSymbolMarkerBearing(marker, deg);
    return;
  }

  setVehicleDomMarkerBearing(marker, deg);
}

export function setVehicleMarkerHighlighted(marker, highlighted) {
  if (marker?.__type === 'symbol') {
    setVehicleSymbolMarkerHighlighted(marker, highlighted);
    return;
  }

  setVehicleDomMarkerHighlighted(marker, highlighted);
}

export function updateVehicleMarkerVisualByZoom(marker, zoom) {
  if (marker?.__type === 'symbol') {
    updateVehicleSymbolMarkerVisualByZoom(marker, zoom);
    return;
  }

  updateVehicleDomMarkerVisualByZoom(marker, zoom);
}

export function removeVehicleMarkerFromLayer(layer, marker) {
  if (marker?.__type === 'symbol') {
    removeVehicleSymbolMarker(marker);
    return;
  }

  removeLayerFromGroup(layer, marker);
}

export function removeVehicleMarkerFromMap(map, marker) {
  if (marker?.__type === 'symbol') {
    removeVehicleSymbolMarker(marker);
    return;
  }

  removeMapLayer(map, marker);
}