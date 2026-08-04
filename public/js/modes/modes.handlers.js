import { getVehicleMarkerPosition } from '../map/markers/vehicle.marker.js';

const FOCUS_ZOOM = 17; // valor del zoon cuando se hace foco

export function createModeHandlers({
  map,
  replayLayer,
  realtimeLayer,
  TENANT_ID,
  CONFIG,
  startReplay,
  stopReplay,
  startRealtime,
  stopRealtime,
  startRealtimeMulti,
  animateMove,
  createVehicleMarker,
  clearReplay,
  updateFleetStatus,
  getRealtimeMulti
}) {
  let activeMode = null;
  
    let followRAF = null;
    
    function startFocusCamera(getMarker) {
      stopFocusCamera();
    
      let didSetZoom = false;
    
      function loop() {
        const marker = getMarker();
        if (marker) {
          const ll = getVehicleMarkerPosition(marker);
    
          // 🔹 ajustar zoom SOLO al entrar en foco
          if (!didSetZoom) {
            map.setView(ll, FOCUS_ZOOM, { animate: false });
            didSetZoom = true;
          } else {
            // 🔹 luego solo seguir con pan
            map.panTo(ll, { animate: false });
          }
        }
        followRAF = requestAnimationFrame(loop);
      }
      followRAF = requestAnimationFrame(loop);
    }
    
    function stopFocusCamera() {
      if (followRAF) {
        cancelAnimationFrame(followRAF);
        followRAF = null;
      }
    }  

  function stopActiveMode() {
    stopFocusCamera();
    if (activeMode === 'replay') {
      stopReplay(map);
      replayLayer.clearLayers();
    }
    activeMode = null;
  }
  
  function stopFocusMode() {
    stopActiveMode();
  }

  function onReplayClick(getUnit) {
    stopActiveMode();
    activeMode = 'replay';

    startReplay({
      map,
      layer: replayLayer,
      tenantId: TENANT_ID,
      unitId: getUnit(),
      from: CONFIG.REPLAY.FROM,
      to: CONFIG.REPLAY.TO
    });
  }

  // ðŸ”´ MODO ACTIVO (click, foco, 10s)
    function startRealtimeMode(getUnit) {
      stopActiveMode();
      activeMode = 'focus-camera';
    
      startFocusCamera(() => {
        return getRealtimeMulti()?.getMarker?.(getUnit());
      });
    }
  
    function startRealtimeMultiMode(getUnitIds) {
      stopActiveMode();        // ← igual que otros modos
      activeMode = 'multi';    // ← NUEVO
    
      const unitIds = getUnitIds(); // array
      if (!unitIds || !unitIds.length) return;
    
      startRealtimeMulti(unitIds);
    }

  return {
    onReplayClick,
    startRealtimeMode,
    startRealtimeMultiMode,
    stopFocusMode
  };
}
