import { getMarkerElement } from './map.adapter.js';

let highlightedMarker = null;

export function highlightUnitMarkerById({ unitId, markers }) {
  if (!markers) return;

  if (highlightedMarker) {
    highlightedMarker.__isHighlighted = false;

    const oldEl = getMarkerElement(highlightedMarker);
    if (oldEl) oldEl.classList.remove('veh-marker-highlight');
  }

  const marker = markers.get(unitId);
  if (!marker) return;

  const el = getMarkerElement(marker);
  if (!el) return;

  el.classList.add('veh-marker-highlight');
  marker.__isHighlighted = true;
  highlightedMarker = marker;

}

export function clearUnitMarkerHighlight() {
  
  if (!highlightedMarker) return;

  highlightedMarker.__isHighlighted = false;

  const el = getMarkerElement(highlightedMarker);
  if (el) el.classList.remove('veh-marker-highlight');

  highlightedMarker = null;

}