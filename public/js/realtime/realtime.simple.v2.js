import { createReplayMarker } from '../common/helpers.js';
import { upsertFleetState } from '../fleet/fleet.state.store.mjs';
import { updateOrientation } from '../realtime/orientation.engine.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import { renderSummaryFromBackend } from '../grid/grid.render.js';
import { initCameraControl, updateFollow, hasFollow  } from '../map/map.camera.control.js';
import { updateFloating, closeFloating } from '../map/map.floating.js';
import { renderClients } from '../map/map.clients.js';

let intervalId = null;

export function runRealtimeV2({ map, layer, url }) {
    
    const markers = new Map();
    const motions = new Map();
    initCameraControl({ map, markers });

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
        const base = json.base || null;
        
        renderClients(map, json);
        
        if (!json || !json.units) return;
        json.units.forEach(u => {
        
            let marker = markers.get(u.unit_id);

            // 1) CREACIÓN (solo por active + con coordenadas válidas)
            if (!marker && u.active === 1 && u.lat != null && u.lng != null) {
            
                marker = createReplayMarker(layer, {
                    lat: u.lat,
                    lng: u.lng
                });
                marker.__lastPoint = { lat: u.lat, lng: u.lng };
                markers.set(u.unit_id, marker);
            
                const motion = new UnitMotion(marker);
                motion.setInitialPoint({ lat: u.lat, lng: u.lng });
                motions.set(u.unit_id, motion);
            }
            
            // 2) DESTRUCCIÃ“N (solo por active)
            if (u.active !== 1) {
              if (marker) {
                layer.removeLayer(marker);
                markers.delete(u.unit_id);
                motions.delete(u.unit_id);
            
                // 🔴 cerrar floating si corresponde
                if (window.AppState?.mode === 'FLOATING' && window.AppState?.activeUnitId === u.unit_id) {
                  closeFloating();
            
                  if (window.AppState) {
                    window.AppState.activeUnitId = null;
                  }
                  document.querySelectorAll('.row.active')
                    .forEach(e => e.classList.remove('active'));
                }
              }
              return;
            } 
            
            // 3) ACTUALIZACIÃ“N (SIEMPRE que exista)
            if (marker) {
            
                // 🔒 solo actualizar si hay coordenadas
                if (u.lat !== null && u.lng !== null) {
            
                    const motion = motions.get(u.unit_id);
                    const curr = { lat: u.lat, lng: u.lng };
                    const prev = marker.__lastPoint || null;
            
                    motion.applyServerPoint(curr);
            
                    updateOrientation({
                      marker,
                      lastPoint: prev,
                      currPoint: curr,
                      state: (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) ? 'MOVING' : 'STOPPED'
                    });
            
                    marker.__lastPoint = curr;
                }
                // 🎯 OPACITY (SIEMPRE se ejecuta)
                if (u.tech_state === 'OFFLINE') {
                  marker.setOpacity(u.is_visible_on_map ? 0.3 : 0);
                } else {
                  marker.setOpacity(u.is_visible_on_map ? 1 : 0);
                }
            }
            if (u.lat !== null && u.lng !== null) {
              upsertFleetState({ unitId: u.unit_id, lat: u.lat, lng: u.lng, seen: true });
            }
        });
        window.renderGrid(json.units, json.base);
        window.renderVehiculosChart(json);
        window.renderPedidosChart(json);
    }
    tick();
    intervalId = setInterval(tick, 10000);  
    
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
        updateFloating(markers);
        requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);   
    
    
    // 🔑 Motion reset on visibility restore
    // Evita que UnitMotion continúe con estado viejo al volver a la pestaña.
    // Comportamiento:
    // - Marker queda en último punto (correcto)
    // - Motion se reinicia desde ese punto
    // - Próximo dato → animación normal (sin saltos ni retrocesos)    
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
    
        // 🔴 RESET TOTAL DE MOTION (clave)
        motions.forEach((motion, unitId) => {
          const marker = markers.get(unitId);
          if (!marker) return;
    
          const curr = marker.__lastPoint;
          if (!curr) return;
    
          const newMotion = new UnitMotion(marker);
          newMotion.setInitialPoint(curr);
    
          motions.set(unitId, newMotion);
        });
    
        clearInterval(intervalId);
        tick();
        intervalId = setInterval(tick, 10000);
      }
    });  
    
    return {
      stop() {
        running = false;
        clearInterval(intervalId);
        intervalId = null;
      }
    };
}
