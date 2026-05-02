import { stopFollow } from './map.camera.control.js';
import { initMap } from './map.init.js';
import { createReplayMarker } from '../common/helpers.js';
import { updateOrientation } from '../realtime/orientation.engine.js';

let floatingMap = null;

let floatingMarker = null;
let activeUnitId = null;

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

let isResizing = false;

let lastPoint = null;

// ---------------------  PERSISTENCIA ----------------------------------------
const STORAGE_KEY = 'floating_state';

function saveState(el) {
  if (!el) return;

  const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  state.left = el.style.left;
  state.top = el.style.top;
  state.width = el.style.width;
  state.height = el.style.height;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(el) {
  if (!el) return;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const state = JSON.parse(raw);

    if (state.left) el.style.left = state.left;
    if (state.top) el.style.top = state.top;
    if (state.width) el.style.width = state.width;
    if (state.height) el.style.height = state.height;

    el.style.right = 'auto';
    el.style.bottom = 'auto';
  } catch (e) {}
}
// -----------------------------------------------------------------------------

export function initFloatingMap(defaultLat, defaultLng, baseRadiusM) {
    const container = document.getElementById('floating-map');
    if (!container) return;
    
    //const res = initMap(defaultLat, defaultLng, baseRadiusM);
    const res = initMap('floating-map', defaultLat, defaultLng, baseRadiusM);
    
    floatingMap = res.map;
  
    floatingMap.on('zoomend', () => {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      state.zoom = floatingMap.getZoom();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    });  
}

export function openFloating(unitId) {
    activeUnitId = unitId;
    
    stopFollow();  
    
    const el = document.getElementById('floating-map');
    if (el) {
        el.classList.remove('hidden');
        loadState(el);
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
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            try {
              const state = JSON.parse(raw);
              if (state.zoom) {
                floatingMap.setZoom(state.zoom);
              }
            } catch (e) {}
          }
        }
    }, 0);
}

export function closeFloating() {
    activeUnitId = null;
    
    if (floatingMarker) {
        floatingMap.removeLayer(floatingMarker);
        floatingMarker = null;
    }
    const el = document.getElementById('floating-map');
    if (el) el.classList.add('hidden');
    
    const label = document.getElementById('floating-label');
    if (label) {
      label.classList.add('hidden');
    }  
    lastPoint = null;
}

export function updateFloating(markersRef) {
  if (!floatingMap || !activeUnitId) return;

  const marker = markersRef.get(activeUnitId);
  if (!marker) return;

  const p = marker.getLatLng();
  if (!p) return;

  // crear marker si no existe
  if (!floatingMarker) {
    floatingMarker = createReplayMarker(floatingMap, p);
    lastPoint = p;
    return;
  }

  // mover marker
  floatingMarker.setLatLng(p);

  // ORIENTACIÓN (igual al mapa principal)
  updateOrientation({
    marker: floatingMarker,
    lastPoint: lastPoint,
    currPoint: p,
    state: 'MOVING'
  });

  // guardar punto anterior
  lastPoint = p;

  // centrar mapa
  floatingMap.panTo(p, { animate: false });
}

export function enableFloatingDrag() {
    const el = document.getElementById('floating-map');
    if (!el) return;
    
    el.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    });
    
    document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    el.style.left = (e.clientX - offsetX) + 'px';
    el.style.top = (e.clientY - offsetY) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        saveState(el); // 🔴 guardar posición
      }
      isDragging = false;
    });
}

export function enableFloatingResize() {
    
  const el = document.getElementById('floating-map');
  const corner = el?.querySelector('.floating-resize');
  const left = el?.querySelector('.resize-left');
  const right = el?.querySelector('.resize-right');
  const bottom = el?.querySelector('.resize-bottom');
  if (!el) return;

  let mode = null;

  // --- MOUSEDOWN ---
  corner?.addEventListener('mousedown', (e) => {
    mode = 'corner';
    isResizing = true;
    e.stopPropagation();
  });

  left?.addEventListener('mousedown', (e) => {
    mode = 'left';
    isResizing = true;
    e.stopPropagation();
  });
  
  right?.addEventListener('mousedown', (e) => {
    mode = 'right';
    isResizing = true;
    e.stopPropagation();
  });

  bottom?.addEventListener('mousedown', (e) => {
    mode = 'bottom';
    isResizing = true;
    e.stopPropagation();
  });

  // --- MOUSEMOVE ---
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const rect = el.getBoundingClientRect();

    if (mode === 'corner') {
      const w = e.clientX - rect.left;
      const h = e.clientY - rect.top;

      if (w > 150) el.style.width = w + 'px';
      if (h > 100) el.style.height = h + 'px';
    }
    
    if (mode === 'left') {
      const dx = rect.left - e.clientX;
      const newWidth = rect.width + dx;
    
      if (newWidth > 150) {
        el.style.width = newWidth + 'px';
        el.style.left = (el.offsetLeft - dx) + 'px';
      }
    }    

    if (mode === 'right') {
      const w = e.clientX - rect.left;
      if (w > 150) el.style.width = w + 'px';
    }

    if (mode === 'bottom') {
      const h = e.clientY - rect.top;
      if (h > 100) el.style.height = h + 'px';
    }
  });

  // --- MOUSEUP ---
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      saveState(el);
    }
    isResizing = false;
    mode = null;
  });
}

export function enableFloatingClose() {
    const btn = document.getElementById('floating-close');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
    closeFloating();
    
    if (window.AppState) {
      window.AppState.activeUnitId = null;
    }
    document.dispatchEvent(new Event('grid:sync'));
    
    stopFollow();
    
    });
}