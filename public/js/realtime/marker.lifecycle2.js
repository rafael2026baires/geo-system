// marker.lifecycle.js

export function syncMarkerLifecycle({
  ctx,
  hasActiveTrip,
  createMarkerFn,
  layer,
  currPoint
}) {
  // CREAR
  if (hasActiveTrip && !ctx.marker && currPoint) {
    ctx.marker = createMarkerFn(layer, {
      lat: currPoint.lat,
      lng: currPoint.lng
    });

    // 🔴 estado inicial visual
    ctx.marker.__visualState = 'INIT';

    return;
  }

  // DESTRUIR
  if (!hasActiveTrip && ctx.marker) {
    ctx.marker.remove();
    ctx.marker = null;
    ctx.motion = null;
    return;
  }
}