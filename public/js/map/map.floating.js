import { stopFollow } from './map.camera.control.js';
import { initMap } from './map.init.js';
import { createVehicleMarker, updateVehicleMarkerVisualByZoom, getVehicleMarkerPosition, removeVehicleMarkerFromMap} from './markers/vehicle.marker.js';
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
  getMapZoom
} from './map.adapter.js';

let floatingMap = null;

let floatingMarker = null;
let floatingMotion = null;
let lastFloatingServerPoint = null;
let activeUnitId = null;

let lastPoint = null;
let lastRealtimeData = null;

const FLOATING_ANIMATION_MIN_ZOOM = 15;

export function setFloatingRealtimeData(data) {
  lastRealtimeData = data;
  renderFloatingClients();
}

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
    removeVehicleMarkerFromMap(floatingMap, floatingMarker);
  }

  floatingMarker = null;
  floatingMotion = null;
  lastFloatingServerPoint = null;
  lastPoint = null;
}

const FLOATING_CLIENTS_SOURCE_ID = 'geo-floating-clients-source';
const FLOATING_CLIENT_RADIUS_FILL_LAYER_ID = 'geo-floating-clients-radius-fill';
const FLOATING_CLIENT_RADIUS_LINE_LAYER_ID = 'geo-floating-clients-radius-line';
const FLOATING_CLIENT_POINTS_LAYER_ID = 'geo-floating-clients-points';

const FLOATING_CLIENT_RADIUS_METERS = 70;

let floatingClientsLayersReady = false;
let pendingFloatingClientsFeatureCollection = null;

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

function createFloatingClientCirclePolygon(lng, lat, radiusMeters, points = 64) {
  const coords = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;

    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const pointLng = lng + (dx / (111320 * Math.cos(lat * Math.PI / 180)));
    const pointLat = lat + (dy / 110540);

    coords.push([pointLng, pointLat]);
  }

  return coords;
}

function findFloatingActiveUnit() {
  if (!lastRealtimeData?.units || !activeUnitId) return null;

  return lastRealtimeData.units.find(u =>
    String(u.unit_id) === String(activeUnitId) ||
    String(u.vehicle_id) === String(activeUnitId)
  );
}

function buildFloatingClientsFeatureCollection() {
  const unit = findFloatingActiveUnit();

  const radiusColor = getCssVar('--map-client-circle-color', '#00e5ff');
  const doneColor = getCssVar('--map-client-done-color', '#22c55e');
  const pendingColor = getCssVar('--map-client-pending-color', '#f97316');

  const features = [];

  if (!unit?.clients || unit.clients.length === 0) {
    return {
      type: 'FeatureCollection',
      features
    };
  }

  unit.clients.forEach(client => {
    if (client.lat == null || client.lng == null) return;

    const lat = client.lat;
    const lng = client.lng;
    const pointColor = client.status === 40 ? doneColor : pendingColor;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          createFloatingClientCirclePolygon(lng, lat, FLOATING_CLIENT_RADIUS_METERS)
        ]
      },
      properties: {
        kind: 'radius',
        color: radiusColor
      }
    });

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        kind: 'point',
        color: pointColor
      }
    });
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

function ensureFloatingClientsLayers() {
  const map = floatingMap;
  if (!map || floatingClientsLayersReady) return;

  if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
    setTimeout(() => {
      ensureFloatingClientsLayers();

      if (pendingFloatingClientsFeatureCollection) {
        updateFloatingClientsSource(pendingFloatingClientsFeatureCollection);
        pendingFloatingClientsFeatureCollection = null;
      }
    }, 100);

    return;
  }

  if (!map.getSource(FLOATING_CLIENTS_SOURCE_ID)) {
    map.addSource(FLOATING_CLIENTS_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
  }

  if (!map.getLayer(FLOATING_CLIENT_RADIUS_FILL_LAYER_ID)) {
    map.addLayer({
      id: FLOATING_CLIENT_RADIUS_FILL_LAYER_ID,
      type: 'fill',
      source: FLOATING_CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'radius'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.2
      }
    });
  }

  if (!map.getLayer(FLOATING_CLIENT_RADIUS_LINE_LAYER_ID)) {
    map.addLayer({
      id: FLOATING_CLIENT_RADIUS_LINE_LAYER_ID,
      type: 'line',
      source: FLOATING_CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'radius'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 0.5,
        'line-opacity': 0.4
      }
    });
  }

  if (!map.getLayer(FLOATING_CLIENT_POINTS_LAYER_ID)) {
    map.addLayer({
      id: FLOATING_CLIENT_POINTS_LAYER_ID,
      type: 'circle',
      source: FLOATING_CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'point'],
      paint: {
        'circle-radius': 2,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.7,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.8
      }
    });
  }

  floatingClientsLayersReady = true;
}

function updateFloatingClientsSource(featureCollection) {
  if (!floatingMap) return;

  const source = floatingMap.getSource(FLOATING_CLIENTS_SOURCE_ID);

  if (!source) {
    pendingFloatingClientsFeatureCollection = featureCollection;
    return;
  }

  source.setData(featureCollection);
}

function renderFloatingClients() {
  if (!floatingMap || !activeUnitId || !lastRealtimeData?.units) return;

  const featureCollection = buildFloatingClientsFeatureCollection();

  ensureFloatingClientsLayers();

  if (!floatingClientsLayersReady) {
    pendingFloatingClientsFeatureCollection = featureCollection;
    return;
  }

  updateFloatingClientsSource(featureCollection);
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

      updateVehicleMarkerVisualByZoom(floatingMarker, getMapZoom(floatingMap));
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
  const p = marker.__lastPoint || getVehicleMarkerPosition(marker);
  if (!p) return;

  // crear marker si no existe
  if (!floatingMarker) {    
    floatingMarker = createVehicleMarker(floatingMap, p, getMapZoom(floatingMap));

    floatingMotion = new UnitMotion(floatingMarker);
    floatingMotion.setInitialPoint(p);
    lastFloatingServerPoint = p;

    lastPoint = p;
    renderFloatingClients();
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

  panMapTo(floatingMap, getVehicleMarkerPosition(floatingMarker));
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
    panMapTo(floatingMap, getVehicleMarkerPosition(floatingMarker));
  }
}