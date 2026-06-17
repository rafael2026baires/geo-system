import { highlightUnitMarkerById } from './map.marker.highlight.js';
import {
  getMarkerPosition,
  flyToPosition,
  setMapCenter,
  getMapZoom
} from './map.adapter.leaflet.js';

let followedUnitId = null; 
let mapRef = null;
let markersRef = null;
let mode = 'IDLE'; // IDLE | FOLLOW

export function initCameraControl({ map, markers }) {
  mapRef = map;
  markersRef = markers;
}

export function highlightUnitMarker(unitId) {
  highlightUnitMarkerById({
    unitId,
    markers: markersRef
  });
}

export function focusUnit(unitId) {
  if (!markersRef) return;

  const marker = markersRef.get(unitId);
  if (!marker) return;

  const latlng = getMarkerPosition(marker);
  flyToPosition(mapRef, latlng, 16);
}

export function followUnit(unitId) {
  followedUnitId = unitId;
  mode = 'FOLLOW';
  updateFollowIndicator();
}

export function stopFollow() {
  followedUnitId = null;
  mode = 'IDLE';
  updateFollowIndicator();
}

let lastLat = null;
let lastLng = null;

export function updateFollow() {
  if (!followedUnitId || !markersRef || !mapRef) return;

  const marker = markersRef.get(followedUnitId);

  if (!marker) {
    stopFollow();
    return;
  }

  const p = getMarkerPosition(marker);
  if (!p) return;

  if (p.lat === lastLat && p.lng === lastLng) return;

  lastLat = p.lat;
  lastLng = p.lng;

  setMapCenter(mapRef, p, getMapZoom(mapRef));
}

export function onUserMove() {
  stopFollow();
}

export function hasFollow() {
  return !!followedUnitId;
}

function updateFollowIndicator() {
  const el = document.getElementById('follow-indicator');
  if (!el) return;

  if (mode === 'FOLLOW' && followedUnitId) {
    el.textContent = `Siguiendo: ${followedUnitId}`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}