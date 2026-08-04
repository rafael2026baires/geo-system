import { stopFollow } from './map.camera.control.js';
import { initMap } from './map.init.js';
import { SHOW_MAP_CALIBRATION_UI } from './map.calibration.ui.config.js';
import {
  initFloatingClientMarkers3D,
  updateFloatingClientMarkers3D,
  clearFloatingClientMarkers3D
} from './3d/floating.client.markers.3d.js';
import {
  initFloatingVehicle3D,
  setFloatingVehicle3DPosition,
  setFloatingVehicle3DBearing,
  setFloatingVehicle3DVisible
} from './3d/floating.vehicle.marker.3d.js';
//import { initFloatingVehicle3DCalibrator } from './3d/floating.vehicle.marker.3d.calibrator.js';
import { createVehicleMarker, updateVehicleMarkerVisualByZoom, getVehicleMarkerPosition, removeVehicleMarkerFromMap} from './markers/vehicle.marker.js';
import { updateOrientation } from '../realtime/orientation.engine.js';
import { UnitMotion } from '../realtime/unit.motion.js';
import { clearFocusedUnitId } from '../state/unit.state.js';
import {
  getVehicleContext,
  getOrdersByUnitId
} from '../realtime/realtime.map.context.js';
import {
  buildFloatingVehicleDetailModel,
  buildFloatingOrderDetailModel
} from './labels/focus.info.formatters.js';
import {
  initFloatingFocusInfoLabels,
  updateFloatingFocusedVehicle,
  setFloatingRelatedLocationLabels,
  clearFloatingFocusInfoLabels
} from './labels/floating.focus.info.labels.js';
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
let displayedUnitId = null;

let lastPoint = null;
let lastRealtimeData = null;
let floatingRelatedLocations = [];

const FLOATING_ANIMATION_MIN_ZOOM = 15;
const ENABLE_FLOATING_VEHICLE_2D = false;
const ENABLE_FLOATING_VEHICLE_3D_CALIBRATOR = false;

export function setFloatingRealtimeData(data) {
  lastRealtimeData = data;
  refreshFloatingContext();
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

function showFloatingMap() {
  const el = document.getElementById('floating-map');
  if (el) el.classList.remove('hidden');

  const label = document.getElementById('floating-label');
  if (label) {
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
  setFloatingVehicle3DVisible(floatingMap, false);

  if (ENABLE_FLOATING_VEHICLE_2D && floatingMarker && floatingMap) {
    removeVehicleMarkerFromMap(floatingMap, floatingMarker);
  }

  floatingMarker = null;
  floatingMotion = null;
  lastFloatingServerPoint = null;
  lastPoint = null;
}

const FLOATING_CLIENTS_SOURCE_ID = 'geo-floating-clients-source';
const FLOATING_CLIENT_RADIUS_FILL_LAYER_ID = 'geo-floating-clients-radius-fill';

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
  if (!lastRealtimeData?.units || !displayedUnitId) return null;

  return lastRealtimeData.units.find(u =>
    String(u.unit_id) === displayedUnitId
  );
}

function buildFloatingRelatedLocations() {
  if (!displayedUnitId) return [];

  return getOrdersByUnitId(displayedUnitId).map(order => ({
    order_id: order.order_id,
    unit_id: order.unit_id,
    customer_name: order.customer_name,
    order_status_label: order.order_status_label,
    address: order.address,
    street_address: order.street_address,
    city: order.city,
    lat: order.lat,
    lng: order.lng,
    status: order.status
  }));
}

function refreshFloatingContext() {
  if (!floatingMap) return;

  const unit = findFloatingActiveUnit();
  if (!unit || unit.active !== 1) {
    floatingRelatedLocations = [];
    renderFloatingClients();
    renderFloatingClientMarkers3D();
    clearFloatingFocusInfoLabels(floatingMap);
    return;
  }

  const vehicleContext = getVehicleContext(displayedUnitId);
  const vehicleDetailModel = buildFloatingVehicleDetailModel(
    vehicleContext,
    unit
  );
  floatingRelatedLocations = buildFloatingRelatedLocations();
  const orderDetailModels = floatingRelatedLocations.map(location => ({
    ...buildFloatingOrderDetailModel(location),
    lat: location.lat,
    lng: location.lng
  }));

  updateFloatingFocusedVehicle(floatingMap, vehicleDetailModel);
  setFloatingRelatedLocationLabels(floatingMap, orderDetailModels);
  renderFloatingClients();
  renderFloatingClientMarkers3D();
}

function renderFloatingClientMarkers3D() {
  if (!floatingMap) return;

  if (floatingRelatedLocations.length === 0) {
    clearFloatingClientMarkers3D(floatingMap);
    return;
  }

  const clients = floatingRelatedLocations.flatMap(client => {
    const lat = Number(client.lat);
    const lng = Number(client.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    return [{
      order_id: client.order_id,
      unit_id: client.unit_id,
      status: client.status,
      lat,
      lng
    }];
  });

  updateFloatingClientMarkers3D(floatingMap, clients);
}

function buildFloatingClientsFeatureCollection() {
  const radiusColor = getCssVar('--map-client-circle-color', '#00e5ff');

  const features = [];

  if (floatingRelatedLocations.length === 0) {
    return {
      type: 'FeatureCollection',
      features
    };
  }

  floatingRelatedLocations.forEach(client => {
    if (client.lat == null || client.lng == null) return;

    const lat = client.lat;
    const lng = client.lng;

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
    const layerDefinition = {
      id: FLOATING_CLIENT_RADIUS_FILL_LAYER_ID,
      type: 'fill',
      source: FLOATING_CLIENTS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'radius'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.2
      }
    };

    if (map.getLayer('floating-client-markers-3d-layer')) {
      map.addLayer(layerDefinition, 'floating-client-markers-3d-layer');
    } else {
      map.addLayer(layerDefinition);
    }
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
  if (!floatingMap) return;

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

    if (SHOW_MAP_CALIBRATION_UI) {
      const zoomCalibrationIndicator = document.createElement('div');
      zoomCalibrationIndicator.dataset.temporaryZoomCalibration = 'true';
      zoomCalibrationIndicator.style.cssText = [
        'position:absolute',
        'left:10px',
        'bottom:10px',
        'z-index:10',
        'padding:4px 8px',
        'border-radius:4px',
        'background:rgba(17,24,39,.85)',
        'color:#fff',
        'font:12px/1.4 monospace',
        'pointer-events:none'
      ].join(';');
      const updateZoomCalibrationIndicator = () => {
        zoomCalibrationIndicator.textContent =
          `Zoom: ${getMapZoom(floatingMap).toFixed(1)}`;
      };
      floatingMap.getContainer().appendChild(zoomCalibrationIndicator);
      floatingMap.on('zoom', updateZoomCalibrationIndicator);
      updateZoomCalibrationIndicator();
    }

    initFloatingFocusInfoLabels(floatingMap, {
      vehicleContainer: document.getElementById('floating-label')
    });
    initFloatingVehicle3D(floatingMap);
    if (SHOW_MAP_CALIBRATION_UI && ENABLE_FLOATING_VEHICLE_3D_CALIBRATOR) {
      //initFloatingVehicle3DCalibrator(floatingMap);
    }
    initFloatingClientMarkers3D(floatingMap);
    setMapMinZoom(floatingMap, 15);
  
    floatingMap.on('zoomend', () => {
      if (!displayedUnitId) return;

      saveFloatingStatePatch({
        zoom: getMapZoom(floatingMap)
      });

      if (ENABLE_FLOATING_VEHICLE_2D && floatingMarker) {
        updateVehicleMarkerVisualByZoom(floatingMarker, getMapZoom(floatingMap));
      }
    });

    return floatingMap;
}

export function openFloating(unitId) {
    const nextDisplayedUnitId = String(unitId);
    if (displayedUnitId != null && displayedUnitId !== nextDisplayedUnitId) {
      clearFloatingTrackingState();
    }
    displayedUnitId = nextDisplayedUnitId;
    
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
    showFloatingMap();
    refreshFloatingContext();
    
    hideFollowIndicator();
    restoreFloatingMapView();
}

export function closeFloating() {
    displayedUnitId = null;
    floatingRelatedLocations = [];
    setFloatingVehicle3DVisible(floatingMap, false);
    clearFloatingClientMarkers3D(floatingMap);
    renderFloatingClients();
    clearFloatingFocusInfoLabels(floatingMap);
    clearUnitMarkerHighlight();
    
    clearFloatingTrackingState(); 
    hideFloatingMap();   
    
    closeFocusPanelArea();
    showClosedFocusMessage();
}

export function updateFloating(markersRef, dt = 0) {  

  if (!floatingMap || !displayedUnitId) return;

  const marker = markersRef.get(displayedUnitId);
  if (!marker) return;

  const p = marker.__lastPoint || getVehicleMarkerPosition(marker);
  if (!p) return;

  // crear marker si no existe
  if (!floatingMotion) {
    if (ENABLE_FLOATING_VEHICLE_2D) {
      floatingMarker = createVehicleMarker(floatingMap, p, getMapZoom(floatingMap));
    }
    setFloatingVehicle3DPosition(floatingMap, p);
    setFloatingVehicle3DVisible(floatingMap, true);

    floatingMotion = new UnitMotion(floatingMarker || { setLngLat() {} });
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

    const orientation = updateOrientation({
      marker: ENABLE_FLOATING_VEHICLE_2D ? floatingMarker : null,
      lastPoint: lastPoint,
      currPoint: p,
      state: (lastPoint && (lastPoint.lat !== p.lat || lastPoint.lng !== p.lng)) ? 'MOVING' : 'STOPPED'
    });

    if (orientation != null) {
      setFloatingVehicle3DBearing(
        floatingMap,
        orientation.geographicBearingDeg
      );
    }

    lastPoint = p;
    lastFloatingServerPoint = p;
  }

  if (floatingMotion && shouldAnimateFloatingByZoom()) {
    floatingMotion.tick(dt);
  }

  const currentPosition = ENABLE_FLOATING_VEHICLE_2D
    ? getVehicleMarkerPosition(floatingMarker)
    : floatingMotion?.virtualPos;
  if (currentPosition) {
    setFloatingVehicle3DPosition(floatingMap, currentPosition);
  }

  panMapTo(floatingMap, currentPosition);
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

    clearFocusedUnitId();

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

  if (floatingMotion) {
    const currentPosition = ENABLE_FLOATING_VEHICLE_2D
      ? getVehicleMarkerPosition(floatingMarker)
      : floatingMotion.virtualPos;
    panMapTo(floatingMap, currentPosition);
  }
}
