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

function getVehicleMarkerVisualByZoom(zoom) {
  //if (zoom < 9) return { type: 'dot', size: 8 };
  if (zoom < 13) return { type: 'dot', size: 5 };
  if (zoom < 15) return { type: 'truck', size: 12 };
  if (zoom < 16) return { type: 'truck', size: 14 };
  if (zoom < 18) return { type: 'truck', size: 20 };
  return { type: 'truck', size: 25 };
}

function createVehicleIcon(type, size) {
  if (type === 'dot') {
    return L.divIcon({
      className: 'veh-dot-icon',
      html: `<div class="veh-dot"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  return L.divIcon({
    className: 'veh-icon',
    html: `
      <div class="veh-wrapper">
        <img class="veh-img" src="/assets/images/truck1.png">
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

export function createVehicleMarker(layer, p, zoom = 13) {
  const visual = getVehicleMarkerVisualByZoom(zoom);
  const icon = createVehicleIcon(visual.type, visual.size);

  const marker = L.marker([p.lat, p.lng], {
    icon,
    interactive: true
  }).addTo(layer);
  
  marker.__vehicleMarkerVisual = visual;

  return marker;
}

export function updateVehicleMarkerSize(marker, zoom) {
  if (!marker) return;

  const visual = getVehicleMarkerVisualByZoom(zoom);
  const prev = marker.__vehicleMarkerVisual;

  if (
    prev &&
    prev.type === visual.type &&
    prev.size === visual.size
  ) return;

  marker.setIcon(createVehicleIcon(visual.type, visual.size));
  marker.__vehicleMarkerVisual = visual;

  if (marker.__isHighlighted) {
    const el = marker.getElement();
    if (el) el.classList.add('veh-marker-highlight');
  }  
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