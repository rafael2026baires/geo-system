import { getLedClass } from '../common/led.utils.js';
import { focusUnit, followUnit } from '../map/map.camera.control.js';
import { openFloating, closeFloating } from '../map/map.floating.js';
import { renderKPIs } from '../ui/kpi.render.js';

const containerId = 'grid-new';

export function renderSummaryFromBackend(summary) {
  const el = document.getElementById('fleet-op-summary');
  if (!el) return;

  el.innerHTML = `
    <div>En base: ${summary.idle}</div>
    <div>En viaje: ${summary.delivering}</div>
    <div>Inactivos: ${summary.inactive}</div>
  `;
}

function renderTimeline(u, maxTotal, base) {    

  const A = u.orders_assigned || 0;
  const C = u.orders_loaded || 0;
  const E = u.orders_delivered || 0;

  let clients = u.clients || [];
  // ---------------- ORDEN POR DISTANCIA A BASE ----------------
  const baseLat = base?.lat;
  const baseLng = base?.lng;  

  if (u.active === 1 && baseLat != null && baseLng != null && clients.length > 0) {
      
    clients = [...clients].sort((a, b) => {
      const dA = (a.lat - baseLat) ** 2 + (a.lng - baseLng) ** 2;
      const dB = (b.lat - baseLat) ** 2 + (b.lng - baseLng) ** 2;
      return dA - dB;
    });
  }
  // ---------------- GENERACIÓN DE DOTS ----------------
  let dots = '';

  clients.forEach(c => {
    const isDelivered = (c.status === 40);
    dots += `<div class="dot ${isDelivered ? 'dot-delivered' : ''}"></div>`;
  });
  // ---------------- RETURN ----------------
  return `
    <div class="timeline ${u.state === 'street' ? 'line-active' : ''}">
      <div class="base-box ${u.state === 'base' ? 'base-active' : ''}"></div>
      <div class="line">
        ${dots}
      </div>
    </div>
  `;
}

function renderGrid(units, base) {  
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '<div class="grid-container-geo">';
    
    html += `
    <div class="item"> </div>
    <div class="item"> </div>
    <div class="item">Pedidos</div>
    <div class="item"> </div>
    <div class="item">Ruta</div>
    `;

    const maxTotal = Math.max(...units.map(u => {
      return (u.orders_assigned || 0) + (u.orders_loaded || 0) + (u.orders_delivered || 0);
    }), 1);    
    
    //  DATOS
    units.forEach(u => {    
    
        const A = u.orders_assigned || 0;
        const C = u.orders_loaded || 0;
        const E = u.orders_delivered || 0;
        
        const total = A + C + E || 1;
        
        const pA = (A / total) * 100;
        const pC = (C / total) * 100;
        const pE = (E / total) * 100;  
        
        const totalReal = A + C + E;
        const pGlobal = (totalReal / maxTotal) * 100;
        
        // ---------------------------  DATOS DE LA GRILLA  ----------------
        // * INACTIVOS *
        if (u.active !== 1) {
          html += `
            <div class="item">Vehículo ${u.vehicle_id}</div>
            <div class="item"></div>
            <div class="item"></div>
            <div class="item"></div>
            <div class="item"></div>
          `;
          return;
        }
        // * ACTIVOS *
        html += `
          <div class="item" data-unit="${u.unit_id}">Vehículo ${u.vehicle_id}</div>
          <div class="item"><span class="led ${getLedClass(u.tech_state)}"></span></div>
          
            <div class="item item-bars">
              <div class="bar-seg" style="width:${pGlobal}%">
                <div class="seg base" style="width:${pA}%"></div>
                <div class="seg camion" style="width:${pC}%"></div>
                <div class="seg cliente" style="width:${pE}%"></div>
              </div>
            </div>
            
            <div class="item"></div>
            
            <div class="item item-timeline">
              ${renderTimeline(u, maxTotal, base)}
            </div>
        `;   
        // -------------------------------------------------------------------
    });
    html += '</div>';
    renderKPIs(units);
    container.innerHTML = html;
    
    syncGridSelection();
    
    // ------------------------------------ FOCO Y SEGUMIENTO DE UN MARKER ----------------------
    container.querySelectorAll('[data-unit]').forEach(el => {
      el.addEventListener('click', () => {
    
        const unitId = el.dataset.unit;
        if (!unitId) return;
    
        if (window.AppState) {
          window.AppState.activeUnitId = unitId;
        }
    
        syncGridSelection(); // ← ESTA LÍNEA NUEVA
    
        if (window.AppState?.mode === 'MAP') {
          focusUnit(unitId);
          followUnit(unitId);
          closeFloating();
        }
        if (window.AppState?.mode === 'FLOATING') {
          openFloating(unitId);
        }
    
      });
    }); 
    // -------------------------------------------------------------------------------------------
}
window.renderGrid = renderGrid;

function syncGridSelection() {
  const activeId = window.AppState?.activeUnitId;

  document.querySelectorAll('[data-unit]').forEach(el => {
    if (el.dataset.unit === activeId) {
      el.classList.add('grid-active');
    } else {
      el.classList.remove('grid-active');
    }
  });
}
document.addEventListener('grid:sync', syncGridSelection);

// ----------------------------------------------------------------
// --------  utils potenciales (no usadas por ahora) --------------
/*
function safe(v) {
  return (v === null || v === undefined) ? '' : v;
}

function formatTime(sec) {
  if (!sec && sec !== 0) return '';

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0')
  ].join(':');
}
*/
// ----------------------------------------------------------------