let replayRunning = false;
let rafId = null;

export function startReplayAnimation({
  map,
  marker,
  replayPoints,
  routePoints,
  onStep = null
}) {
  replayRunning = true;
  let replayIndex = 0;
  let routeIndex = 0;
  let lastVisualLatLng = null;

  function moveNext() {
    if (!replayRunning) return;
    if (replayIndex >= replayPoints.length - 1) return;

    const p1 = replayPoints[replayIndex];
    const p2 = replayPoints[replayIndex + 1];

    const dx = p2.lat - p1.lat;
    const dy = p2.lng - p1.lng;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const deltaTs = p2.ts - p1.ts;

    const IS_STOPPED = dist < 0.00003 && deltaTs > 20000;
    const duration = Math.max(1000, deltaTs);

    const startTime = performance.now();
    const FRAME_MS = 50;
    let lastFrameTime = 0;

    function animate(now) {
      if (!replayRunning) return;

      const elapsed = now - startTime;

      if (now - lastFrameTime < FRAME_MS) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now;

      if (IS_STOPPED && lastVisualLatLng) {
        marker.setLatLng(lastVisualLatLng);
        rafId = requestAnimationFrame(animate);
        return;
      }

      const tLinear = Math.min(elapsed / duration, 1);
      const t = tLinear < 0.5
        ? 2 * tLinear * tLinear
        : 1 - Math.pow(-2 * tLinear + 2, 2) / 2;

      const rp1 = routePoints[routeIndex];
      const rp2 = routePoints[routeIndex + 1] || rp1;

      const lat = rp1.lat + (rp2.lat - rp1.lat) * t;
      const lng = rp1.lng + (rp2.lng - rp1.lng) * t;

      marker.setLatLng([lat, lng]);
      lastVisualLatLng = [lat, lng];
      map.panTo([lat, lng], { animate: false });

      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        routeIndex++;
        replayIndex++;
        moveNext();
      }
    }
    
    if (onStep) {
      if (IS_STOPPED) {
        onStep(p1, p1); // detenido por TIEMPO
      } else {
        onStep(p1, p2);
      }
    }
    rafId = requestAnimationFrame(animate);
  }

  moveNext();
}

export function stopReplayAnimation() {
  replayRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}
