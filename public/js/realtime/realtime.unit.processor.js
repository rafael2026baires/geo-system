import { createVehicleMarker } from '../common/helpers.js';
import { upsertFleetState } from '../fleet/fleet.state.store.mjs';
import { updateOrientation } from '../realtime/orientation.engine.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import { closeFloating } from '../map/map.floating.js';
import { getMapZoom, setMarkerOpacity, removeLayerFromGroup} from '../map/map.adapter.leaflet.js';

const VEHICLE_ANIMATION_MIN_ZOOM = 18;

function shouldAnimateVehicleByZoom(map) {
  return getMapZoom(map) >= VEHICLE_ANIMATION_MIN_ZOOM;
}

function applyMarkerOpacity(marker, unit) {
  if (!marker) return;

  if (unit.tech_state === 'OFFLINE') {
    setMarkerOpacity(marker, unit.is_visible_on_map ? 0.3 : 0);
  } else {
    setMarkerOpacity(marker, unit.is_visible_on_map ? 1 : 0);
  }
}

function createUnitMarker({ unit, map, layer, markers, motions }) {
  const marker = createVehicleMarker(layer, {
    lat: unit.lat,
    lng: unit.lng
  }, getMapZoom(map));

  marker.__lastPoint = { lat: unit.lat, lng: unit.lng };
  markers.set(unit.unit_id, marker);

  const motion = new UnitMotion(marker);
  motion.setInitialPoint({ lat: unit.lat, lng: unit.lng });
  motions.set(unit.unit_id, motion);

  return marker;
}

function removeUnitMarker({ unit, layer, markers, motions }) {
  const marker = markers.get(unit.unit_id);
  if (!marker) return;

  removeLayerFromGroup(layer, marker);
  markers.delete(unit.unit_id);
  motions.delete(unit.unit_id);
}

function closeFloatingIfActiveUnit(unit) {
  if (
    window.AppState?.mode === 'FLOATING' &&
    window.AppState?.activeUnitId === unit.unit_id
  ) {
    closeFloating();

    if (window.AppState) {
      window.AppState.activeUnitId = null;
    }

    document.querySelectorAll('.row.active')
      .forEach(e => e.classList.remove('active'));
  }
}

function updateUnitMarkerPosition({ unit, marker, motion, map }) {
  if (unit.lat === null || unit.lng === null) return;
  if (!motion) return;

  const curr = { lat: unit.lat, lng: unit.lng };
  const prev = marker.__lastPoint || null;

  if (shouldAnimateVehicleByZoom(map)) {
    motion.applyServerPoint(curr);
  } else {
    motion.snapTo(curr);
  }

  updateOrientation({
    marker,
    lastPoint: prev,
    currPoint: curr,
    state: (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) ? 'MOVING' : 'STOPPED'
  });

  marker.__lastPoint = curr;
}

function updateFleetState(unit) {
  if (unit.lat === null || unit.lng === null) return;

  upsertFleetState({
    unitId: unit.unit_id,
    lat: unit.lat,
    lng: unit.lng,
    seen: true
  });
}

export function processUnit({ unit, map, layer, markers, motions }) {
  let marker = markers.get(unit.unit_id);

  if (!marker && unit.active === 1 && unit.lat != null && unit.lng != null) {
    marker = createUnitMarker({
      unit,
      map,
      layer,
      markers,
      motions
    });
  }

  if (unit.active !== 1) {
    removeUnitMarker({
      unit,
      layer,
      markers,
      motions
    });

    closeFloatingIfActiveUnit(unit);
    return;
  }

  if (marker) {
    updateUnitMarkerPosition({
      unit,
      marker,
      motion: motions.get(unit.unit_id),
      map
    });

    applyMarkerOpacity(marker, unit);
  }

  updateFleetState(unit);
}