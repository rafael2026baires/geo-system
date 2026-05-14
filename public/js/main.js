import { animateMove, pollLastPoint, createReplayMarker, clearReplay } from './common/helpers.js';
import { loadFleetFromDB } from './fleet/fleet.data.js';
import { initMap } from './map/map.init.js';
import { createModeHandlers } from './modes/modes.handlers.js';
import { wireUI } from './ui/ui.wiring.js';
import { AppState } from './state/unit.state.js';
window.AppState = AppState; // TEMP global for UI sync (sidebar)
AppState.mode = 'MAP';
import { upsertFleetState, fleetStateStore} from './fleet/fleet.state.store.mjs';
import { initViewport } from './map/viewport.controller.js';
import { runRealtimeV2 } from './realtime/realtime.simple.v2.js';
import { stopFollow, onUserMove, focusUnit, followUnit } from './map/map.camera.control.js';
import { initFloatingMap, closeFloating, openFloating, enableFloatingDrag, enableFloatingResize, enableFloatingClose } from './map/map.floating.js';

let TENANT_ID = null;
let realtimeInstance = null;

function getSidebarDefaultWidth() {
  return window.AppConfig?.usesObd ? 940 : 670;
}

fetch('/session_info.php')
  .then(r => r.json())

  .then(cfg => {
      TENANT_ID = cfg.tenant_id;
      window.AppConfig = {
        usesObd: Number(cfg.uses_obd) === 1
      };

      const sidebarEl = document.getElementById('sidebar');
      if (sidebarEl) {
        sidebarEl.style.width = `${getSidebarDefaultWidth()}px`;
      }

      document.getElementById('userBtn').textContent = cfg.user_name + ' ▾';
      initApp(Number(cfg.default_lat), Number(cfg.default_lng), Number(cfg.base_radius_m));
  });

window.isReconnecting = false;

function getActiveUnitFromState() {
  return AppState.activeUnitId;
}

function initApp(defaultLat, defaultLng, baseRadiusM) {
    
    const { map, replayLayer, realtimeLayer } = initMap('map', defaultLat, defaultLng, baseRadiusM); //initMap(defaultLat, defaultLng, baseRadiusM);
    window.mainMap = map;

    initFloatingMap(defaultLat, defaultLng, baseRadiusM);
    enableFloatingDrag();
    enableFloatingResize();
    enableFloatingClose();
    
    if (realtimeInstance) {
      realtimeInstance.stop();
    }
    realtimeInstance = runRealtimeV2({
      map,
      layer: L.layerGroup().addTo(map),            
      url: '/api/realtime/get_units_realtime_v2.php'
    });        

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
    
          if (window.AppState) {
            window.AppState.activeUnitId = null;
            document.dispatchEvent(new Event('grid:sync'));
          }
    
          document.querySelectorAll('.row.active')
            .forEach(e => e.classList.remove('active'));
        }
    
        if (window.AppState?.mode === 'FLOATING') {
          viewport.fitAllNow(); // solo reencuadra mapa
        }
    
      });
    }
    
    // -------------------- MODO MAPA-FLOATING ----------------------------
    const btnModeMap = document.getElementById('modeMap');
    const btnModeFloating = document.getElementById('modeFloating');
    
    function resetSelection() {
      if (window.AppState) {
        window.AppState.activeUnitId = null;
        document.dispatchEvent(new Event('grid:sync'));
      }
    
      document.querySelectorAll('.row.active')
        .forEach(e => e.classList.remove('active'));
    }
    
    if (btnModeMap) {
      btnModeMap.addEventListener('click', () => {
          
        const unitId = window.AppState?.activeUnitId;
        
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
          
        const unitId = window.AppState?.activeUnitId;
        
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
    
        if (window.AppState) {
          window.AppState.activeUnitId = null;
          document.dispatchEvent(new Event('grid:sync'));
        }
        document.querySelectorAll('.row.active')
          .forEach(e => e.classList.remove('active'));
      }
    
      if (window.AppState?.mode === 'FLOATING') {
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
      createReplayMarker,
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
      colors: total === 0 ? ['#555555'] : ['#787777', '#BAB7B6', '#195AB0']
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
  });

  document.addEventListener('mouseup', () => {
    if (!isResizingSidebar) return;

    isResizingSidebar = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (window.mainMap) {
      setTimeout(() => {
        window.mainMap.invalidateSize();
      }, 100);
    }
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
      toggleSidebarBtn.textContent = 'Panel';
    } else {
      sidebar.classList.remove('sidebar-collapsed');
      sidebar.style.width = `${lastSidebarWidth}px`;
      toggleSidebarBtn.textContent = 'Panel';
    }

    if (window.mainMap) {
      setTimeout(() => {
        window.mainMap.invalidateSize();
      }, 100);
    }

    if (lastChartData) {
      setTimeout(() => {
        renderPedidosChart(lastChartData);
        renderVehiculosChart(lastChartData);
      }, 150);
    }

  });
}