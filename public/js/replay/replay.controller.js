import { loadReplayData } from './replay.service.js';
import { clearReplay, renderReplayRoute, createVehicleMarker } from './replay.render.js';
import { startReplayAnimation, stopReplayAnimation } from './replay.anim.js';

import { computeState } from '../common/state.engine.js';
import { distanceMeters } from '../common/helpers.js';

export function startReplay({
  map,
  layer = map,  
  tenantId,
  unitId,
  from,
  to,
  onStatusChange = null
}) {
  clearReplay(map);

  return loadReplayData({
    tenantId,
    unitId,
    from,
    to
  }).then(points => {
    if (!points || !points.length) return;

    const route = renderReplayRoute(layer, points);
    const marker = createVehicleMarker(layer, points[0]);

    let lastPoint = null;
    let stoppedSince = null;
    let lastDataAt = Date.now();

    // ���� Estado inicial (primer punto)
    const first = {
      lat: points[0].lat,
      lng: points[0].lng,
      ts: points[0].ts
    };

    const initState = computeState({
      lastPoint: null,
      currentPoint: first,
      nowTs: Date.now(),
      lastDataAt,
      distanceMetersFn: distanceMeters,
      stoppedSince: null
    });

    if (onStatusChange) onStatusChange(initState.state);

    // ���� Animaci��n + estados por tramo
    startReplayAnimation({
      map,
      marker,
      replayPoints: points,
      routePoints: route,
      onStep: (prev, curr) => {
        lastDataAt = Date.now();

        const result = computeState({
          lastPoint: prev,
          currentPoint: curr,
          nowTs: Date.now(),
          lastDataAt,
          distanceMetersFn: distanceMeters,
          stoppedSince
        });

        stoppedSince = result.stoppedSince;
        if (onStatusChange) onStatusChange(result.state);
      }
    });
  });
}

export function stopReplay(map) {
  clearReplay(map);
  stopReplayAnimation();
}