import { upsertFleetState } from '../fleet/fleet.state.store.mjs';
import { updateOrientation } from '../realtime/orientation.engine.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import { closeFloating } from '../map/map.floating.js';
import { clearFocusedUnitId, getFocusedUnitId } from '../state/unit.state.js';
import { getMapZoom } from '../map/map.adapter.js';
import { createVehicleMarker, setVehicleMarkerOpacity, removeVehicleMarkerFromLayer} from '../map/markers/vehicle.marker.js';
import {
  upsertVehicleFleet3DInstance,
  setVehicleFleet3DPosition,
  setVehicleFleet3DBearing,
  setVehicleFleet3DVisible,
  removeVehicleFleet3DInstance
} from '../map/3d/vehicle.fleet.3d.layer.js';
import {
  upsertVehicleInfoLabel,
  setVehicleInfoLabelVisible,
  removeVehicleInfoLabel
} from '../map/labels/vehicle.info.labels.js';

const VEHICLE_ANIMATION_MIN_ZOOM = 18;
export const ENABLE_MAIN_MAP_VEHICLE_FLEET_3D = true;
const ENABLE_MAIN_MAP_VEHICLE_MARKERS_2D = false;

function shouldAnimateVehicleByZoom(map) {
  return getMapZoom(map) >= VEHICLE_ANIMATION_MIN_ZOOM;
}

function applyMarker2DVisibility(marker) {
  if (!marker || ENABLE_MAIN_MAP_VEHICLE_MARKERS_2D) return;

  if (marker.__type === 'symbol') {
    setVehicleMarkerOpacity(marker, 0);
    return;
  }

  const element = marker.getElement?.();
  if (element) {
    element.style.display = 'none';
    element.style.pointerEvents = 'none';
  }
}

function applyMarkerOpacity(map, marker, unit) {
  if (!marker) return;

  if (!ENABLE_MAIN_MAP_VEHICLE_MARKERS_2D) {
    applyMarker2DVisibility(marker);
  } else if (unit.tech_state === 'OFFLINE') {
    setVehicleMarkerOpacity(marker, unit.is_visible_on_map ? 0.3 : 0);
  } else {
    setVehicleMarkerOpacity(marker, unit.is_visible_on_map ? 1 : 0);
  }

  if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D) {
    setVehicleFleet3DVisible(
      map,
      unit.unit_id,
      Boolean(unit.is_visible_on_map)
    );
  }

  setVehicleInfoLabelVisible(
    map,
    unit.unit_id,
    Boolean(unit.is_visible_on_map)
  );
}

function createUnitMarker({ unit, map, layer, markers, motions }) {
  const marker = createVehicleMarker(layer, {
    lat: unit.lat,
    lng: unit.lng
  }, getMapZoom(map));

  marker.__lastPoint = { lat: unit.lat, lng: unit.lng };
  markers.set(unit.unit_id, marker);
  applyMarker2DVisibility(marker);

  if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D) {
    upsertVehicleFleet3DInstance(map, unit.unit_id, {
      position: { lat: unit.lat, lng: unit.lng },
      bearingDeg: 0,
      visible: Boolean(unit.is_visible_on_map)
    });
  }

  upsertVehicleInfoLabel(map, unit.unit_id, {
    vehicle_id: unit.vehicle_id,
    vehicle_label: unit.vehicle_label,
    vehicle_patent: unit.vehicle_patent,
    vehicle_type: unit.vehicle_type,
    visible: Boolean(unit.is_visible_on_map)
  });

  const motion = new UnitMotion(marker, {
    onPositionChange: position => {
      if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D) {
        setVehicleFleet3DPosition(map, unit.unit_id, position);
      }
    }
  });
  motion.setInitialPoint({ lat: unit.lat, lng: unit.lng });
  motions.set(unit.unit_id, motion);

  return marker;
}

function removeUnitMarker({ unit, map, layer, markers, motions }) {
  const marker = markers.get(unit.unit_id);

  if (marker) {
    removeVehicleMarkerFromLayer(layer, marker);
  }
  if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D) {
    removeVehicleFleet3DInstance(map, unit.unit_id);
  }
  removeVehicleInfoLabel(map, unit.unit_id);
  markers.delete(unit.unit_id);
  motions.delete(unit.unit_id);
}

function closeFloatingIfActiveUnit(unit) {
  if (
    window.AppState?.mode === 'FLOATING' &&
    getFocusedUnitId() === String(unit.unit_id)
  ) {
    closeFloating();
    clearFocusedUnitId();

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

  const orientation = updateOrientation({
    marker,
    lastPoint: prev,
    currPoint: curr,
    state: (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) ? 'MOVING' : 'STOPPED'
  });

  if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D && orientation) {
    setVehicleFleet3DBearing(
      map,
      unit.unit_id,
      orientation.geographicBearingDeg
    );
  }

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
      map,
      layer,
      markers,
      motions
    });

    closeFloatingIfActiveUnit(unit);
    return;
  }

  if (marker) {
    upsertVehicleInfoLabel(map, unit.unit_id, {
      vehicle_id: unit.vehicle_id,
      vehicle_label: unit.vehicle_label,
      vehicle_patent: unit.vehicle_patent,
      vehicle_type: unit.vehicle_type,
      visible: Boolean(unit.is_visible_on_map)
    });

    updateUnitMarkerPosition({
      unit,
      marker,
      motion: motions.get(unit.unit_id),
      map
    });

    applyMarkerOpacity(map, marker, unit);
  }

  updateFleetState(unit);
}
