import { animateMove, pollLastPoint, clearReplay } from './common/helpers.js';
import { createVehicleMarker } from './map/markers/vehicle.marker.js';
import { loadFleetFromDB } from './fleet/fleet.data.js';
import { initMap } from './map/map.init.js';
import { createModeHandlers } from './modes/modes.handlers.js';
import { wireUI } from './ui/ui.wiring.js';
import {
  AppState,
  clearFocusedUnitId,
  getFocusedUnitId
} from './state/unit.state.js';
window.AppState = AppState; // TEMP global for UI sync (sidebar)
AppState.mode = 'FLOATING';
AppState.mainViewMode = 'FIT_ALL';
import { upsertFleetState, fleetStateStore} from './fleet/fleet.state.store.mjs';
import { initViewport } from './map/viewport.controller.js';
import { runRealtimeV2 } from './realtime/realtime.simple.v2.js';
import { stopFollow, onUserMove, focusUnit, followUnit } from './map/map.camera.control.js';
import { initFloatingMap, closeFloating, openFloating, enableFloatingDrag, 
         enableFloatingResize, enableFloatingClose, enableFloatingDetach, refreshFloatingMapView } 
         from './map/map.floating.js';
import { saveFloatingStatePatch } from './map/map.floating.state.js';    
import { createLayerGroup, invalidateMapSize } from './map/map.adapter.js';     
import { initMapCameraUI } from './map/map.camera.ui.js';
import { initMapStyleUI } from './map/map.style.ui.js';
import { initMapLabelsUI } from './map/map.labels.ui.js';
import { runMap360Demo } from './map/map.demo.rotation.js';
import { initMap3DLab } from './map/3d/map.3d.lab.js';
import { SHOW_MAP_CALIBRATION_UI } from './map/map.calibration.ui.config.js';

let TENANT_ID = null;
let realtimeInstance = null;
const ENABLE_3D_SCALE_CALIBRATOR = true;

// TELEMETRÍA / OBD OCULTA TEMPORALMENTE - V1 COMERCIAL
/*
function getSidebarDefaultWidth() {
  return window.AppConfig?.usesObd ? 940 : 670;
}
*/
function getSidebarDefaultWidth() {
  return 1050;
}

fetch('/session_info.php')
  .then(r => r.json())

  .then(async cfg => {
      TENANT_ID = cfg.tenant_id;
      window.AppConfig = {
        usesObd: Number(cfg.uses_obd) === 1
      };

      if (typeof window.loadUiTheme === 'function') {
        await window.loadUiTheme();
      }

      const sidebarEl = document.getElementById('sidebar');
      if (sidebarEl) {
        sidebarEl.style.width = `${getSidebarDefaultWidth()}px`;
      }

      document.getElementById('userBtn').textContent = cfg.user_name + ' ▾';
      initApp(Number(cfg.default_lat), Number(cfg.default_lng), Number(cfg.base_radius_m));
  });

window.isReconnecting = false;

function getActiveUnitFromState() {
  return getFocusedUnitId();
}

function initApp(defaultLat, defaultLng, baseRadiusM) {
    
    const { map, replayLayer, realtimeLayer } = initMap('map', defaultLat, defaultLng, baseRadiusM); //initMap(defaultLat, defaultLng, baseRadiusM);
    window.mainMap = map;

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
        zoomCalibrationIndicator.textContent = `Zoom: ${map.getZoom().toFixed(1)}`;
      };
      map.getContainer().appendChild(zoomCalibrationIndicator);
      map.on('zoomend', updateZoomCalibrationIndicator);
      updateZoomCalibrationIndicator();
    }

    initMapCameraUI(map);
    initMapStyleUI(map);
    initMap3DLab(map, {
      enabled: true
    });

    // --------------  conexión botón 360 grados ----------------------
    const btnMapDemo360 = document.getElementById('btnMapDemo360');

    if (btnMapDemo360) {
      btnMapDemo360.addEventListener('click', () => {
        runMap360Demo(map, {
          secondsPerTurn: 100,
          pitch: map.getPitch(),
          //clockwise: true
          clockwise: false
        });
      });
    }
    // ----------------------------------------------------------------

    const floatingMap = initFloatingMap(defaultLat, defaultLng, baseRadiusM);
    if (SHOW_MAP_CALIBRATION_UI && ENABLE_3D_SCALE_CALIBRATOR) {
      import('./map/3d/map.3d.calibrator.js')
        .then(({ initMap3DCalibrator }) => {
          initMap3DCalibrator({
            mainMap: map,
            floatingMap
          });
        })
        .catch(error => {
          console.error('[MAP-3D-CALIBRATOR]', error);
        });
    }
    enableFloatingDrag();
    enableFloatingResize();
    enableFloatingClose();
    enableFloatingDetach();
    
    if (realtimeInstance) {
      realtimeInstance.stop();
    }
    realtimeInstance = runRealtimeV2({
      map,      
      layer: createLayerGroup(map),      
      url: '/api/realtime/get_units_realtime_v2.php'
    });
    initMapLabelsUI(map);

    const viewportFlags = {
      viewportMode: 'AUTO',
      autoFitPolicy: 'FIT_ALL',
      fallbackZone: 'TENANT_DEFAULT'
    };
    
    const viewport = initViewport({
      map,
      getUnits: () =>
          Array.from(fleetStateStore.entries())
            .filter(([_, rec]) => rec?.lat != null && rec?.lng != null)
            .map(([id, rec]) => ({
              id,
              lat: rec?.lat,
              lng: rec?.lng
            }))
            .filter(u => u.lat != null && u.lng != null),
      getActiveUnit: () => AppState.activeUnit || null,
      getFlags: () => viewportFlags
    });
    window.viewport = viewport;
    
let didInitialViewportFit = false;

const initialViewportTimer = setInterval(() => {
  if (didInitialViewportFit) {
    clearInterval(initialViewportTimer);
    return;
  }

  const units = Array.from(fleetStateStore.values())
    .filter(rec => rec?.lat != null && rec?.lng != null);

  if (units.length > 0) {
    didInitialViewportFit = true;
    viewport.fitAllNow();
    clearInterval(initialViewportTimer);
  }
}, 500);   
    
    // ------------------- VER TODOS -------------------------------------
    const btnFitAll = document.getElementById('btnFitAll');
    
    if (btnFitAll) {
      btnFitAll.addEventListener('click', () => {
    
        if (window.AppState?.mode === 'MAP') {
          stopFollow();
          closeFloating();
          stopFocusMode();
          viewport.fitAllNow();
    
          clearFocusedUnitId();
          document.dispatchEvent(new Event('grid:sync'));
    
          document.querySelectorAll('.row.active')
            .forEach(e => e.classList.remove('active'));
        }
    
        if (window.AppState?.mode === 'FLOATING') {
          AppState.mainViewMode = 'FIT_ALL';
          viewport.fitAllNow(); // solo reencuadra mapa
        }
    
      });
    }
    
    // -------------------- MODO MAPA-FLOATING ----------------------------
    const btnModeMap = document.getElementById('modeMap');
    const btnModeFloating = document.getElementById('modeFloating');
    
    function resetSelection() {
      clearFocusedUnitId();
      document.dispatchEvent(new Event('grid:sync'));
    
      document.querySelectorAll('.row.active')
        .forEach(e => e.classList.remove('active'));
    }
    
    if (btnModeMap) {
      btnModeMap.addEventListener('click', () => {
          
        const unitId = getFocusedUnitId();
        
        AppState.mode = 'MAP';
        closeFloating();
        
        if (unitId) {
          focusUnit(unitId);
          followUnit(unitId);
        } 
        else {
          stopFollow();
        }
        
        updateModeLabel();
      });
    }
    
    if (btnModeFloating) {
      btnModeFloating.addEventListener('click', () => {
          
        const unitId = getFocusedUnitId();
        
        AppState.mode = 'FLOATING';
        
        if (unitId) {
            stopFollow(); 
            openFloating(unitId);
        } 
        else {
            closeFloating();
            stopFollow();
            resetSelection();
            document.dispatchEvent(new Event('grid:sync'));
        }
        
        updateModeLabel();
      });
    }  
    // ----------------- LABEL MODO BARRA SUPERIOR --------------------
    const modeLabel = document.getElementById('modeLabel');
    
    function updateModeLabel() {
      if (!modeLabel) return;
    
      if (AppState.mode === 'MAP') {
        modeLabel.textContent = 'Modo: Mapa';
      }
    
      if (AppState.mode === 'FLOATING') {
        modeLabel.textContent = 'Modo: Ventana';
      }
    }    
    updateModeLabel();
    // ------------------ ARRASTRE EN EL MAPA -------------------------
    map.on('dragstart', () => {
    
      if (window.AppState?.mode === 'MAP') {
        onUserMove();
        viewport.onUserMovedMap();
        closeFloating();
    
        clearFocusedUnitId();
        document.dispatchEvent(new Event('grid:sync'));
        document.querySelectorAll('.row.active')
          .forEach(e => e.classList.remove('active'));
      }
    
      if (window.AppState?.mode === 'FLOATING') {
        AppState.mainViewMode = 'MANUAL';
        viewport.onUserMovedMap(); // solo mover mapa
      }
    
    });
    // --------------------------------------------------------------------    

    const realtimeMulti = null;
    
    const {
      onReplayClick,
      startRealtimeMode,
      startRealtimeMultiMode,
      stopFocusMode
    } = createModeHandlers({
      map,
      replayLayer,
      realtimeLayer,
      TENANT_ID,
      startRealtimeMulti: () => {},
      pollLastPoint,
      animateMove,
      createVehicleMarker,
      clearReplay,
      getRealtimeMulti: () => null
    });    
    
    
    window.startRealtimeMode = startRealtimeMode;
    
    function setPanelUnit(unitId) {
      const el = document.getElementById('unitIdLabel');
      if (el) el.textContent = unitId || '–';
    }
    
    function setPanelStatus(text) {
      const el = document.getElementById('unitStatus');
      if (el) el.textContent = text || '–';
    }
    
    function setPanelMode(text) {
      const el = document.getElementById('unitMode');
      if (el) el.textContent = text || '–';
    }
    wireUI({ onReplayClick, startRealtimeMode, getActiveUnit: getActiveUnitFromState });
    
          loadFleetFromDB(TENANT_ID).then(() => {
          const units = window.fleetBackend.map(u => u.device_uuid);
          // precargar store en UNKNOWN
          units.forEach(unitId => {
            upsertFleetState({ unitId, state: 'UNKNOWN', ts: null });
          });
        });
    
        function resetDashboard() {
        
          stopFocusMode();
          clearReplay(map);
          viewport.fitAllNow();
        }
}

// ===== USER MENU (logout) =====
const userBtn = document.getElementById('userBtn');
const userMenu = document.getElementById('userMenu');

if (userBtn && userMenu) {
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('user-menu-hidden');
  });

  document.addEventListener('click', () => {
    userMenu.classList.add('user-menu-hidden');
  });
}
// ---------------------------------------------------------------------------------------
let lastChartData = null;

function renderPedidosChart(data) {  // TORTA 3D

  lastChartData = data;

  google.charts.load('current', { packages: ['corechart'] });
  google.charts.setOnLoadCallback(() => {
    
    const A = data.orders_summary.A;
    const C = data.orders_summary.C;
    const E = data.orders_summary.E;
    const total = A + C + E;
    
    let ped;
    if (total === 0) {
      ped = google.visualization.arrayToDataTable([
        ['Estado', 'Cantidad'],
        ['Sin datos', 1]
      ]);
    } else {
      ped = google.visualization.arrayToDataTable([
        ['Estado', 'Cantidad'],
        ['Pendientes', A],
        ['Cargados', C],
        ['Entregados', E]
      ]);
    }
    const chart = new google.visualization.PieChart(
      document.getElementById('chart-pedidos-3d')
    );

    chart.draw(ped, {
      is3D: true,
      backgroundColor: 'transparent',
      legend: 'none',
      chartArea: { width: '90%', height: '85%' },
      pieStartAngle: 100,
      colors: total === 0 ? ['#261C1A'] : ['#787777', '#BAB7B6', '#195AB0']
    });
  });
}
window.renderPedidosChart = renderPedidosChart;
// ----------------------------------------------------------------------------------------
function renderVehiculosChart(data) { // BARRAS 2D
  google.charts.load('current', { packages: ['corechart'] });
  google.charts.setOnLoadCallback(() => {

    const veh = google.visualization.arrayToDataTable([
      ['Estado', 'Cantidad'],
      ['Base', data.summary.idle],
      ['Tránsito', data.summary.delivering],
      ['Cliente', data.summary.client]
    ]);

    const chart = new google.visualization.ColumnChart(
      document.getElementById('chart-vehiculos-3d')
    );
    
    const TOTAL_VEHICULOS = data.total_vehicles;

    chart.draw(veh, {
      backgroundColor: 'transparent',
      legend: 'none',
      chartArea: { width: '80%', height: '70%' },  // tamaño interno de barras
      hAxis: {
        textStyle: { color: '#aaa' }
      },
      vAxis: {
          minValue: 0,
          maxValue: TOTAL_VEHICULOS, 
          textStyle: { color: '#aaa' },
          gridlines: { color: 'transparent' }
      },  
      colors: ['#FF2EF5']
    });

  });
}
window.renderVehiculosChart = renderVehiculosChart;
// ---------------------------------------------------------------------------------------

// ------------------------------------------------------------
// SIDEBAR RESIZE MANUAL
// ------------------------------------------------------------
const sidebar = document.getElementById('sidebar');
const sidebarResizer = document.getElementById('sidebar-resizer');

if (sidebar && sidebarResizer) {
    let isResizingSidebar = false;

    sidebarResizer.addEventListener('mousedown', () => {
      isResizingSidebar = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizingSidebar) return;

      const minWidth = 50;    
      const maxWidth = getSidebarDefaultWidth();

      const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));

      sidebar.style.width = `${newWidth}px`;

      refreshMainMapView();
      refreshFloatingMapView();
    });

    document.addEventListener('mouseup', () => {
      if (!isResizingSidebar) return;

      isResizingSidebar = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      setTimeout(() => {
        refreshMainMapView();
        refreshFloatingMapView();
      }, 100);

    });  
}

// ------------------------------------------------------------
// SIDEBAR COLAPSAR / RESTAURAR
// ------------------------------------------------------------
const toggleSidebarBtn = document.getElementById('toggleSidebar');

let lastSidebarWidth = getSidebarDefaultWidth();

if (toggleSidebarBtn && sidebar) {
  toggleSidebarBtn.addEventListener('click', () => {

    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');

    if (!isCollapsed) {
      lastSidebarWidth = sidebar.offsetWidth;
      sidebar.classList.add('sidebar-collapsed');      
    } else {
      sidebar.classList.remove('sidebar-collapsed');
      sidebar.style.width = `${lastSidebarWidth}px`;      
    }

    setTimeout(() => {
      refreshMainMapView();
      refreshFloatingMapView();
    }, 100);    

    if (lastChartData) {
      setTimeout(() => {
        renderPedidosChart(lastChartData);
        renderVehiculosChart(lastChartData);
      }, 150);
    }

  });
}

// ------------------------------------------------------------
// FOCUS PANEL RESIZE VERTICAL
// ------------------------------------------------------------
const focusPanel = document.getElementById('focus-panel');
const focusResizer = document.getElementById('focus-resizer');

if (focusPanel && focusResizer) {
  let isResizingFocus = false;

  focusResizer.addEventListener('mousedown', () => {
    isResizingFocus = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizingFocus) return;

    const layoutTop = document.getElementById('layout').getBoundingClientRect().top;
    const layoutHeight = document.getElementById('layout').offsetHeight;

    const mouseY = e.clientY - layoutTop;
    const focusHeight = layoutHeight - mouseY;

    const minFocusHeight = 0;
    const maxFocusHeight = Math.floor(layoutHeight * 0.55);

    const newHeight = Math.max(
      minFocusHeight,
      Math.min(maxFocusHeight, focusHeight)
    );

    focusPanel.style.height = `${newHeight}px`;
    saveFloatingStatePatch({ attachedHeight: `${newHeight}px` });

    refreshMainMapView();
    refreshFloatingMapView();
  });

  document.addEventListener('mouseup', () => {
    if (!isResizingFocus) return;

    isResizingFocus = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    saveFloatingStatePatch({ attachedHeight: focusPanel.style.height });

    refreshMainMapView();
    refreshFloatingMapView();

  });
}

function refreshMainMapView() {
  if (!window.mainMap) return;

  invalidateMapSize(window.mainMap);

  if (
    window.AppState?.mainViewMode === 'FIT_ALL' &&
    window.viewport
  ) {
    window.viewport.fitAllNow();
  }
}
