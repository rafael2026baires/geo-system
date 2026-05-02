let replayPolyline = null;
let replayMarker = null;

// target puede ser: map O layerGroup
export function clearReplay(target) {
  if (replayPolyline) target.removeLayer(replayPolyline);
  if (replayMarker) target.removeLayer(replayMarker);

  replayPolyline = null;
  replayMarker = null;
}


export function renderReplayRoute(target, points) {
  replayPolyline = L.polyline(
    points.map(p => [p.lat, p.lng]),
    { color: 'blue', weight: 4 }
  ).addTo(target);

  // Si el target es el mapa, ajustamos vista
  if (typeof target.fitBounds === 'function') {
    target.fitBounds(replayPolyline.getBounds());
  }

  return replayPolyline.getLatLngs();
}


export function createReplayMarker(target, firstPoint) {
  replayMarker = L.circleMarker(
    [firstPoint.lat, firstPoint.lng],
    { radius: 8, color: 'blue' }
  ).addTo(target);

  return replayMarker;
}