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
import {
  invalidateMapSize,
  setMapZoom,
  setMapMinZoom,
  panMapTo,
  removeMapLayer,
  getMapZoom,
  getMarkerPosition
} from './map.adapter.js';

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

function openAttachedFocusPanel() {
  const focusPanel = document.getElementById('focus-panel');
  if (!focusPanel) return;

  const state = getFloatingState();
  focusPanel.classList.add('focus-panel-open');
  focusPanel.style.height = state.attachedHeight || '260px';
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

function showClosedFocusMessage() {
  const emptyMessage = document.getElementById('focus-empty-message');
  if (!emptyMessage) return;

  emptyMessage.classList.remove('hidden');
  emptyMessage.innerHTML = `
    <div class="focus-empty-title">Sin vehículo en foco</div>
    <div class="focus-empty-text">
      Seleccione un vehículo de la grilla para iniciar seguimiento.
    </div>
  `;
}

function setDetachButtonState(isDetached) {
  const btn = document.getElementById('floating-detach');
  if (!btn) return;

  btn.textContent = isDetached ? '⇲' : '⇱';
  btn.title = isDetached ? 'Acoplar ventana' : 'Desacoplar ventana';
}

function clearFloatingBoxInlineStyles(el) {
  if (!el) return;

  el.style.removeProperty('left');
  el.style.removeProperty('top');
  el.style.removeProperty('right');
  el.style.removeProperty('bottom');
  el.style.removeProperty('width');
  el.style.removeProperty('height');
}

function showFloatingMap(unitId) {
  const el = document.getElementById('floating-map');
  if (el) el.classList.remove('hidden');

  const label = document.getElementById('floating-label');
  if (label) {
    label.textContent = `Unidad: ${unitId}`;
    label.classList.remove('hidden');
  }
}

function hideFloatingMap() {
  const el = document.getElementById('floating-map');
  if (el) el.classList.add('hidden');

  const label = document.getElementById('floating-label');
  if (label) label.classList.add('hidden');
}

function hideFollowIndicator() {
  const indicator = document.getElementById('follow-indicator');
  if (indicator) indicator.classList.add('hidden');
}

function restoreFloatingMapView() {
  requestAnimationFrame(() => {
    if (!floatingMap) return;

    invalidateMapSize(floatingMap);

    const state = getFloatingState();
    if (state.zoom) {
      setMapZoom(floatingMap, state.zoom);
    }
  });
}

function refreshMainMapAfterLayoutChange() {
  requestAnimationFrame(() => {
    if (window.mainMap) invalidateMapSize(window.mainMap);
  });
}

function shouldAnimateFloatingByZoom() {
  return floatingMap && getMapZoom(floatingMap) >= FLOATING_ANIMATION_MIN_ZOOM;
}

function clearFloatingTrackingState() {
  if (floatingMarker && floatingMap) {
    removeMapLayer(floatingMap, floatingMarker);
  }

  floatingMarker = null;
  floatingMotion = null;
  lastFloatingServerPoint = null;
  lastPoint = null;
}

function detachFloatingWindow(el) {
  el.classList.add('floating-detached');

  loadFloatingBoxState(el);

  closeFocusPanelArea();
  showDetachedFocusMessage();

  setDetachButtonState(true);
}

function attachFloatingWindow(el) {
  el.classList.remove('floating-detached');

  openAttachedFocusPanel();

  const emptyMessage = document.getElementById('focus-empty-message');
  if (emptyMessage) {
    emptyMessage.classList.add('hidden');
  }

  clearFloatingBoxInlineStyles(el);
  setDetachButtonState(false);
}

export function initFloatingMap(defaultLat, defaultLng, baseRadiusM) {
    const container = document.getElementById('floating-map');
    if (!container) return;    

    const res = initMap('floating-map', defaultLat, defaultLng, baseRadiusM);
    
    floatingMap = res.map;
    setMapMinZoom(floatingMap, 15);
  
    floatingMap.on('zoomend', () => {
      if (!activeUnitId) return;

      saveFloatingStatePatch({
        zoom: getMapZoom(floatingMap)
      });

      updateVehicleMarkerSize(floatingMarker, getMapZoom(floatingMap));
    });  
}

export function openFloating(unitId) {
    activeUnitId = unitId;
    
    stopFollow();    

    const focusPanel = document.getElementById('focus-panel');
    const emptyMessage = document.getElementById('focus-empty-message');

    const el = document.getElementById('floating-map');
    const isDetached = el?.classList.contains('floating-detached');    

    if (isDetached) {
        closeFocusPanelArea();
    } else if (!focusPanel?.style.height || focusPanel.style.height === '0px') {
        openAttachedFocusPanel();
    }

    if (isDetached) {
        showDetachedFocusMessage();
    } else if (emptyMessage) {
        emptyMessage.classList.add('hidden');
    }
    showFloatingMap(unitId);    
    
    hideFollowIndicator();
    restoreFloatingMapView();
}

export function closeFloating() {
    activeUnitId = null;
    clearUnitMarkerHighlight();
    
    clearFloatingTrackingState(); 
    hideFloatingMap();   
    
    closeFocusPanelArea();
    showClosedFocusMessage();
}

export function updateFloating(markersRef, dt = 0) {  

  if (!floatingMap || !activeUnitId) return;

  const marker = markersRef.get(activeUnitId);
  if (!marker) return;

  //const p = marker.getLatLng();
  const p = marker.__lastPoint || getMarkerPosition(marker);
  if (!p) return;

  // crear marker si no existe
  if (!floatingMarker) {    
    floatingMarker = createVehicleMarker(floatingMap, p, getMapZoom(floatingMap));

    floatingMotion = new UnitMotion(floatingMarker);
    floatingMotion.setInitialPoint(p);
    lastFloatingServerPoint = p;

    lastPoint = p;
    panMapTo(floatingMap, p);
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

  panMapTo(floatingMap, getMarkerPosition(floatingMarker));
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
    refreshMainMapAfterLayoutChange();

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
      detachFloatingWindow(el);
    } else {
      attachFloatingWindow(el);
    }

    requestAnimationFrame(() => {
      if (window.mainMap) invalidateMapSize(window.mainMap);
      refreshFloatingMapView();
    });
  });

}

export function refreshFloatingMapView() {
  if (!floatingMap) return;

  invalidateMapSize(floatingMap);

  if (floatingMarker) {
    panMapTo(floatingMap, getMarkerPosition(floatingMarker));
  }
}