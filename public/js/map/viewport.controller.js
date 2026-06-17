// VIEWPORT CONTROLLER
// Responsabilidad: decidir centro/zoom del mapa.
// NO conoce realtime ni estados t��cnicos.
// Reacciona a:
// - cambios de unidades (coordenadas)
// - unidad activa
// - acciones del usuario (pan/zoom)
// Mantener l��gica intacta mientras ordenamos el frontend.


import { saveViewportState, loadViewportState } from './viewport.persistence.js';
import { createBoundsFromUnits } from './map.adapter.js';

export function initViewport({ map, getUnits, getActiveUnit, getFlags }) {
    
    /*
    const saved = loadViewportState();
    if (saved) {
      map.setView(saved.center, saved.zoom);
    }
    */
    
  let didInitialAutoFit = false;
  let mode = 'AUTO';

  function apply() {
    const { viewportMode, autoFitPolicy, fallbackZone } = getFlags();
    
    if (mode === 'MANUAL') return;

    const units = getUnits().filter(u => u.lat != null && u.lng != null);

    if (!units.length) {
      if (fallbackZone === 'TENANT_DEFAULT') {
        map.setView([window.defaultLat, window.defaultLng], 13);
        return;
      }
      return;
    }

    if (mode === 'FOCUS' && autoFitPolicy === 'CENTER_ACTIVE') {
      const u = getActiveUnit();
      if (u && u.lat != null && u.lng != null) {
        map.setView([u.lat, u.lng], 14);
      }
      return;
    }

    if (autoFitPolicy === 'FIT_ALL') {
        
      if (didInitialAutoFit) return;
      const bounds = createBoundsFromUnits(units);
    
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 2000 ? 14 : 11
      });
    }
  }

    function onAppStart() {
    apply();
    }

    function onUnitsUpdated() {
      apply();
    }


  function onActiveUnitChanged() {
    apply();
  }

  function onUserMovedMap() {
    mode = 'MANUAL';
    saveViewportState({ map, viewportMode: 'MANUAL' });
  }
  
    function fitAllNow() {
      const units = getUnits().filter(u => u.lat != null && u.lng != null);
      if (!units.length) return;
    
      const bounds = createBoundsFromUnits(units);
      const diag = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
    
      //console.log('[fitAllNow] diagonal (m):', Math.round(diag));
    
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom:
            diag < 2000  ? 16 :
            diag < 10000 ? 14 :
            diag < 30000 ? 12 :
                           11
        });
    }
    
  function exitFocusToAuto() {
    mode = 'AUTO';
    saveViewportState({ map, viewportMode: 'AUTO' });
  }
  
  function forceManualViewport() {
    mode = 'MANUAL';
    saveViewportState({ map, viewportMode: 'MANUAL' });
  }

  return {
    onAppStart,
    onUnitsUpdated,
    onActiveUnitChanged,
    onUserMovedMap,
    fitAllNow,
    exitFocusToAuto,
    forceManualViewport
  };
}