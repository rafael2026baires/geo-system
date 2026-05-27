import { stopFollow } from './map.camera.control.js';
import { initMap } from './map.init.js';
import { createVehicleMarker, updateVehicleMarkerSize } from '../common/helpers.js';
import { updateOrientation } from '../realtime/orientation.engine.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import {
  getFloatingState,
  saveFloatingStatePatch,
  loadFloatingBoxState,
  saveFloatingBoxState
} from './map.floating.state.js';
import { enableFloatingDragBehavior } from './map.floating.drag.js';
import { enableFloatingResizeBehavior } from './map.floating.resize.js';
import { clearUnitMarkerHighlight } from './map.marker.highlight.js';

let floatingMap = null;

let floatingMarker = null;
let floatingMotion = null;
let lastFloatingServerPoint = null;
let activeUnitId = null;

let lastPoint = null;

const FLOATING_ANIMATION_MIN_ZOOM = 15;

function closeFocusPanelArea() {
  const focusPanel = document.getElementById('focus-panel');
  if (focusPanel) focusPanel.style.height = '0px';
}

function showDetachedFocusMessage() {
  const emptyMessage = document.getElementById('focus-empty-message');
  if (!emptyMessage) return;

  emptyMessage.classList.remove('hidden');
  emptyMessage.innerHTML = `
    <div class="focus-empty-title">Foco desacoplado</div>
    <div class="focus-empty-text">
      El seguimiento está abierto en ventana flotante.
    </div>
  `;
}

function shouldAnimateFloatingByZoom() {
  return floatingMap && floatingMap.getZoom() >= FLOATING_ANIMATION_MIN_ZOOM;
}



export function initFloatingMap(defaultLat, defaultLng, baseRadiusM) {
    const container = document.getElementById('floating-map');
    if (!container) return;    

    const res = initMap('floating-map', defaultLat, defaultLng, baseRadiusM);
    
    floatingMap = res.map;
    floatingMap.setMinZoom(15);
  
    floatingMap.on('zoomend', () => {
      if (!activeUnitId) return;

      saveFloatingStatePatch({
        zoom: floatingMap.getZoom()
      });

      updateVehicleMarkerSize(floatingMarker, floatingMap.getZoom());
    });  
}

export function openFloating(unitId) {
    activeUnitId = unitId;
    
    stopFollow();    

    const focusPanel = document.getElementById('focus-panel');
    const emptyMessage = document.getElementById('focus-empty-message');

    const el = document.getElementById('floating-map');
    const isDetached = el?.classList.contains('floating-detached');    

    if (focusPanel) {
        focusPanel.classList.add('focus-panel-open');

        if (isDetached) {
            closeFocusPanelArea();
        } else if (!focusPanel.style.height || focusPanel.style.height === '0px') {
            const state = getFloatingState();
            focusPanel.style.height = state.attachedHeight || '260px';
        }
    }

    if (isDetached) {
        showDetachedFocusMessage();
    } else if (emptyMessage) {
        emptyMessage.classList.add('hidden');
    }
    if (el) {
        el.classList.remove('hidden');
    }  
    
    const label = document.getElementById('floating-label');
    if (label) {
        label.textContent = `Unidad: ${unitId}`;
        label.classList.remove('hidden');
    }    
    
    const indicator = document.getElementById('follow-indicator');
    if (indicator) indicator.classList.add('hidden');   
    
    // 🔴 PRIMERO recalcular tamaño
    setTimeout(() => {
        if (floatingMap) {
          floatingMap.invalidateSize();

          // 🔴 DESPUÉS aplicar zoom
          const state = getFloatingState();
          if (state.zoom) {
            floatingMap.setZoom(state.zoom);
          }
        }
    }, 0);
}

export function closeFloating() {
    activeUnitId = null;
    clearUnitMarkerHighlight();
    
    if (floatingMarker) {
        floatingMap.removeLayer(floatingMarker);
        floatingMarker = null;
    }
    floatingMotion = null;
    lastFloatingServerPoint = null;    

    const el = document.getElementById('floating-map');
    if (el) el.classList.add('hidden');
    
    const label = document.getElementById('floating-label');
    if (label) {
      label.classList.add('hidden');
    }  
    lastPoint = null;

    const focusPanel = document.getElementById('focus-panel');
    const emptyMessage = document.getElementById('focus-empty-message');

    if (focusPanel) {
      focusPanel.style.height = '0px';
    }

    if (emptyMessage) {
      emptyMessage.classList.remove('hidden');
      emptyMessage.innerHTML = `
        <div class="focus-empty-title">Sin vehículo en foco</div>
        <div class="focus-empty-text">
          Seleccione un vehículo de la grilla para iniciar seguimiento.
        </div>
      `;
    }
}

export function updateFloating(markersRef, dt = 0) {  

  if (!floatingMap || !activeUnitId) return;

  const marker = markersRef.get(activeUnitId);
  if (!marker) return;

  //const p = marker.getLatLng();
  const p = marker.__lastPoint || marker.getLatLng();
  if (!p) return;

  // crear marker si no existe
  if (!floatingMarker) {    
    floatingMarker = createVehicleMarker(floatingMap, p, floatingMap.getZoom());

    floatingMotion = new UnitMotion(floatingMarker);
    floatingMotion.setInitialPoint(p);
    lastFloatingServerPoint = p;

    lastPoint = p;
    floatingMap.panTo(p, { animate: false });
    return;
  }

  const isNewPoint =
    !lastFloatingServerPoint ||
    lastFloatingServerPoint.lat !== p.lat ||
    lastFloatingServerPoint.lng !== p.lng;

  if (isNewPoint) {
    if (shouldAnimateFloatingByZoom()) {
      floatingMotion.applyServerPoint(p);
    } else {
      floatingMotion.snapTo(p);
    }

    updateOrientation({
      marker: floatingMarker,
      lastPoint: lastPoint,
      currPoint: p,
      state: (lastPoint && (lastPoint.lat !== p.lat || lastPoint.lng !== p.lng)) ? 'MOVING' : 'STOPPED'
    });

    lastPoint = p;
    lastFloatingServerPoint = p;
  }

  if (floatingMotion && shouldAnimateFloatingByZoom()) {
    floatingMotion.tick(dt);
  }

  floatingMap.panTo(floatingMarker.getLatLng(), { animate: false });
}

export function enableFloatingDrag() {
  enableFloatingDragBehavior({
    getElement: () => document.getElementById('floating-map'),
    onSave: saveFloatingBoxState
  });
}

export function enableFloatingResize() {
  enableFloatingResizeBehavior({
    getElement: () => document.getElementById('floating-map'),
    onSave: saveFloatingBoxState,
    onResize: () => {
      requestAnimationFrame(() => {
        refreshFloatingMapView();
      });
    }
  });
}

export function enableFloatingClose() {
    const btn = document.getElementById('floating-close');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
    closeFloating();
        requestAnimationFrame(() => {
      window.mainMap?.invalidateSize();
    });
    
    if (window.AppState) {
      window.AppState.activeUnitId = null;
    }
    document.dispatchEvent(new Event('grid:sync'));
    
    stopFollow();
    
    });
}

export function enableFloatingDetach() {

  const btn = document.getElementById('floating-detach');
  const el = document.getElementById('floating-map');

  if (!btn || !el) return;

  btn.addEventListener('click', () => {
    const willDetach = !el.classList.contains('floating-detached');

    if (willDetach) {
      el.classList.add('floating-detached');

      loadFloatingBoxState(el);

      const focusPanel = document.getElementById('focus-panel');
      const emptyMessage = document.getElementById('focus-empty-message');
      
      closeFocusPanelArea();
      showDetachedFocusMessage();      

      btn.textContent = '⇲';
      btn.title = 'Acoplar ventana';
    } else {
      el.classList.remove('floating-detached');

      const focusPanel = document.getElementById('focus-panel');
      const emptyMessage = document.getElementById('focus-empty-message');

      if (focusPanel) {
          const state = getFloatingState();
          focusPanel.style.height = state.attachedHeight || '260px';
      }

      if (emptyMessage) {
        emptyMessage.classList.add('hidden');
      }      

      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('width');
      el.style.removeProperty('height');

      btn.textContent = '⇱';
      btn.title = 'Desacoplar ventana';
    }

    requestAnimationFrame(() => {
      window.mainMap?.invalidateSize();
      refreshFloatingMapView();
    });
  });

}

export function refreshFloatingMapView() {
  if (!floatingMap) return;

  floatingMap.invalidateSize();

  if (floatingMarker) {
    floatingMap.panTo(floatingMarker.getLatLng(), { animate: false });
  }
}