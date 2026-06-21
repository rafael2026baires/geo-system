import { setVehicleMarkerHighlighted } from './markers/vehicle.marker.js';

let highlightedMarker = null;

export function highlightUnitMarkerById({ unitId, markers }) {
  if (!markers) return;

  if (highlightedMarker) {
    setVehicleMarkerHighlighted(highlightedMarker, false);
  }

  const marker = markers.get(unitId);
  if (!marker) return;

  setVehicleMarkerHighlighted(marker, true);
  highlightedMarker = marker;
}

export function clearUnitMarkerHighlight() {
  if (!highlightedMarker) return;

  setVehicleMarkerHighlighted(highlightedMarker, false);
  highlightedMarker = null;
}