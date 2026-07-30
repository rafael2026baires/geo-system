let demoRotationFrame = null;
let demoRotationRunning = false;

export function runMap360Demo(map, options = {}) {
  if (!map) return;

  // Si ya está girando, el mismo botón la frena
  if (demoRotationRunning) {
    stopMap360Demo();
    return;
  }

  const {
    secondsPerTurn = 40,     // segundos por cada vuelta completa
    clockwise = true
  } = options;

  demoRotationRunning = true;

  const startTime = performance.now();
  const startBearing = map.getBearing();
  const direction = clockwise ? 1 : -1;

  function animate(now) {
    if (!demoRotationRunning) return;

    const elapsed = now - startTime;
    const degreesPerMs = 360 / (secondsPerTurn * 1000);
    const bearing = startBearing + direction * elapsed * degreesPerMs;

    map.setBearing(bearing);

    demoRotationFrame = requestAnimationFrame(animate);
  }

  demoRotationFrame = requestAnimationFrame(animate);
}

export function stopMap360Demo() {
  demoRotationRunning = false;

  if (demoRotationFrame) {
    cancelAnimationFrame(demoRotationFrame);
    demoRotationFrame = null;
  }
}
