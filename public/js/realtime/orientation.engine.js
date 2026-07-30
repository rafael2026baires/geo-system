// OrientationEngine
// Único responsable del bearing (rotación del PNG)
// Regla: SOLO rota si state === MOVING
// NO toca opacity
// NO toca labels
// NO maneja reconexión

import { setVehicleMarkerBearing } from '../map/markers/vehicle.marker.js';

const DEFAULT_ICON_OFFSET_DEG = -90; // ajustá según orientación del PNG

function bearingDeg(a, b) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

function setMarkerBearing(marker, deg) {
  setVehicleMarkerBearing(marker, deg);
}

export function updateOrientation({
  marker,
  lastPoint,
  currPoint,
  state,
  iconOffsetDeg = DEFAULT_ICON_OFFSET_DEG
}) {
  if (!lastPoint || !currPoint) return null;

  // OFFLINE / STOPPED / NO_DATA → NO rotar
  if (state !== 'MOVING') return null;

  const geographicBearingDeg = bearingDeg(lastPoint, currPoint);
  const markerBearingDeg = geographicBearingDeg + iconOffsetDeg;

  if (marker) {
    setMarkerBearing(marker, markerBearingDeg);
  }

  return {
    geographicBearingDeg,
    markerBearingDeg
  };
}
