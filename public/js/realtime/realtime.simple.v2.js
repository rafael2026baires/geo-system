import { updateVehicleMarkerVisualByZoom } from '../map/markers/vehicle.marker.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import { initCameraControl, updateFollow, hasFollow  } from '../map/map.camera.control.js';
import { updateFloating, setFloatingRealtimeData } from '../map/map.floating.js';
import { renderClients } from '../map/map.clients.js';
import { renderRealtimeDashboard } from './realtime.dashboard.render.js';
import {
  processUnit,
  ENABLE_MAIN_MAP_VEHICLE_FLEET_3D
} from './realtime.unit.processor.js';
import { refreshDashboardCharts } from '../dashboard/dashboard.charts.data.js';
import { onMapZoomEnd, getMapZoom} from '../map/map.adapter.js';
import { updateMap3DClients } from '../map/3d/map.3d.lab.js';
import {
  initVehicleFleet3DLayer,
  destroyVehicleFleet3DLayer,
  syncVehicleFleet3DFocus
} from '../map/3d/vehicle.fleet.3d.layer.js';
import {
  initVehicleInfoLabels,
  updateVehicleInfoLabelScreenBounds,
  setFocusedVehicleInfoLabel,
  clearFocusedVehicleInfoLabel,
  destroyVehicleInfoLabels
} from '../map/labels/vehicle.info.labels.js';
import {
  initLocationInfoLabels,
  setFocusedLocationInfoLabels,
  clearFocusedLocationInfoLabels,
  destroyLocationInfoLabels
} from '../map/labels/location.info.labels.js';
import {
  updateRealtimeContext,
  getVehicleContext,
  getOrdersByUnitId
} from './realtime.map.context.js';
import {
  getFocusedUnitId,
  subscribeFocusedUnit
} from '../state/unit.state.js';

let intervalId = null;

export function runRealtimeV2({ map, layer, url }) {
    initVehicleInfoLabels(map);
    if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D) {
      initVehicleFleet3DLayer(map, {
        onScreenBounds: boundsByUnitId => {
          updateVehicleInfoLabelScreenBounds(map, boundsByUnitId);
        }
      });
    }
    initLocationInfoLabels(map);
    
    const markers = new Map();
    const motions = new Map();
    initCameraControl({ map, markers });

    function refreshFocusedInfo(focusedUnitId = getFocusedUnitId()) {
      if (!focusedUnitId) {
        clearFocusedVehicleInfoLabel(map);
        clearFocusedLocationInfoLabels(map);
        return;
      }

      setFocusedVehicleInfoLabel(
        map,
        focusedUnitId,
        getVehicleContext(focusedUnitId)
      );
      setFocusedLocationInfoLabels(
        map,
        focusedUnitId,
        getOrdersByUnitId(focusedUnitId)
      );
    }

    const unsubscribeFocusedUnit = subscribeFocusedUnit((
      focusedUnitId,
      previousFocusedUnitId
    ) => {
      refreshFocusedInfo(focusedUnitId);
      syncVehicleFleet3DFocus(map, focusedUnitId, previousFocusedUnitId);
    });

    const handleMapZoomEnd = () => {
      markers.forEach(marker => {
        updateVehicleMarkerVisualByZoom(marker, getMapZoom(map));
      });
    };
    onMapZoomEnd(map, handleMapZoomEnd);

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

        try {
          updateRealtimeContext(json);
        } catch (e) {
          console.error('[REALTIME-CONTEXT-ERROR]', e);
        }
        
        renderClients(map, json);
        updateMap3DClients(map, json);
        setFloatingRealtimeData(json);
        
        if (!json || !json.units) {
          refreshFocusedInfo();
          return;
        }
        json.units.forEach(unit => {
          processUnit({
            unit,
            map,
            layer,
            markers,
            motions
          });
        });
        refreshFocusedInfo();
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

        const newMotion = new UnitMotion(marker, {
          onPositionChange: motion.onPositionChange
        });
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
        map.off('zoomend', handleMapZoomEnd);
        document.removeEventListener('visibilitychange', handleVisibilityRestore);
        unsubscribeFocusedUnit();
        clearFocusedVehicleInfoLabel(map);
        clearFocusedLocationInfoLabels(map);
        if (ENABLE_MAIN_MAP_VEHICLE_FLEET_3D) {
          destroyVehicleFleet3DLayer(map);
        }
        destroyVehicleInfoLabels(map);
        destroyLocationInfoLabels(map);
        //stopDashboardChartsPolling();
      }
    };
}
