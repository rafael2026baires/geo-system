import { updateVehicleMarkerVisualByZoom } from '../map/markers/vehicle.marker.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import { renderSummaryFromBackend } from '../grid/grid.render.js';
import { initCameraControl, updateFollow, hasFollow  } from '../map/map.camera.control.js';
import { updateFloating, setFloatingRealtimeData } from '../map/map.floating.js';
import { renderClients } from '../map/map.clients.js';
import { renderRealtimeDashboard } from './realtime.dashboard.render.js';
import { processUnit } from './realtime.unit.processor.js';
import { refreshDashboardCharts } from '../dashboard/dashboard.charts.data.js';
import { onMapZoomEnd, getMapZoom} from '../map/map.adapter.js';

let intervalId = null;

export function runRealtimeV2({ map, layer, url }) {
    
    const markers = new Map();
    const motions = new Map();
    initCameraControl({ map, markers });

    onMapZoomEnd(map, () => {
      markers.forEach(marker => {
        updateVehicleMarkerVisualByZoom(marker, getMapZoom(map));
      });
    });

    async function tick() {
    
        let json = null;
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          json = await res.json();
        } catch (e) {
          console.error('[REALTIME-ERROR]', e);
          return;
        }
        
        renderClients(map, json);
        setFloatingRealtimeData(json);
        
        if (!json || !json.units) return;
        json.units.forEach(unit => {
          processUnit({
            unit,
            map,
            layer,
            markers,
            motions
          });
        });
        renderRealtimeDashboard(json);
        try {
          refreshDashboardCharts();
        } catch (e) {
          console.error('[DASHBOARD-CHARTS-CALL-ERROR]', e);
        }

        
    }
    tick();
    intervalId = setInterval(tick, 10000);  
    //startDashboardChartsPolling();
    
    let last = null;
    let running = true;
    
    function rafLoop(now) {
        if (!running) return;
    
        if (!last) last = now;
        const dt = (now - last) / 1000;
        last = now;
    
        motions.forEach((motion, unitId) => {
            motion.tick(dt);
        });
        if (hasFollow()) {
          updateFollow();
        }
        updateFloating(markers, dt);
        requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);    
    
    function resetMotionsFromCurrentMarkers() {
      motions.forEach((motion, unitId) => {
        const marker = markers.get(unitId);
        if (!marker) return;

        const curr = marker.__lastPoint;
        if (!curr) return;

        const newMotion = new UnitMotion(marker);
        newMotion.setInitialPoint(curr);

        motions.set(unitId, newMotion);
      });
    }   
    
    function restartPolling() {
      clearInterval(intervalId);
      tick();
      intervalId = setInterval(tick, 10000);
    }

    function handleVisibilityRestore() {
      if (document.hidden) return;

      resetMotionsFromCurrentMarkers();
      restartPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityRestore);
    
    return {
      stop() {
        running = false;
        clearInterval(intervalId);
        intervalId = null;
        //stopDashboardChartsPolling();
      }
    };
}