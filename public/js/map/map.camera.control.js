let followedUnitId = null; // unitId currently followed by camera
let mapRef = null;
let markersRef = null;
let mode = 'IDLE'; // IDLE | FOLLOW

// init desde realtime
export function initCameraControl({ map, markers }) {
  mapRef = map;
  markersRef = markers;
}

// acciones
export function focusUnit(unitId) {
  if (!markersRef) return;

  const marker = markersRef.get(unitId);
  if (!marker) return;

  const latlng = marker.getLatLng();
  mapRef.flyTo(latlng, 16);
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

// usado desde RAF
let lastLat = null;
let lastLng = null;

export function updateFollow() {
  if (!followedUnitId || !markersRef || !mapRef) return;

  const marker = markersRef.get(followedUnitId);

  if (!marker) {
    stopFollow();
    return;
  }

  const p = marker.getLatLng();
  if (!p) return;

  // 🔹 evitar render innecesario
  if (p.lat === lastLat && p.lng === lastLng) return;

  lastLat = p.lat;
  lastLng = p.lng;

  mapRef.setView(p, mapRef.getZoom(), { animate: false });
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