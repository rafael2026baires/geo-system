let realtimeAnimRunning = false;
let realtimeRafId = null;

export function animateMove(
  marker,
  map,
  p1,
  p2,
  options = {}
) {
  const {
    duration = 9000,
    followMap = true
  } = options;

  const start = performance.now();

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);

    const lat = p1.lat + (p2.lat - p1.lat) * t;
    const lng = p1.lng + (p2.lng - p1.lng) * t;

    marker.setLatLng([lat, lng]);

    if (followMap) {
      map.panTo([lat, lng], { animate: false });
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

export function stopRealtimeAnimation() {
  realtimeAnimRunning = false;
  if (realtimeRafId) {
    cancelAnimationFrame(realtimeRafId);
    realtimeRafId = null;
  }
}

export async function pollLastPoint(tenantId, unitId, lastTs) {
  const url = `last_point.php?tenantId=${tenantId}&unitId=${unitId}&lastTs=${encodeURIComponent(lastTs)}`;
  const res = await fetch(url);
  return await res.json(); // puede ser null
}

export function clearReplay(map) {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });
}

export function distanceMeters(p1, p2) {
  const R = 6371000; // metros
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}