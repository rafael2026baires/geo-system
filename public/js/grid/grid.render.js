import { bindGridEvents, syncGridSelection } from './grid.events.js';
//import { renderKPIs } from '../ui/kpi.render.js';

import { 
  USE_GRID_MOCK, 
  mockBase, 
  mockUnits
} from './grid.mock.js';

import {
  renderSignalCell,
  renderMotionCell,
  renderStateSlot,
  renderOrdersCell
  // renderTimeline // Ruta de nodos desactivada temporalmente
} from './grid.cells.js';

import { getLastUnit, setLastUnits } from './grid.store.js';
import { hasUnitChanged, hasActiveChanged, getChangedUnitsWithoutActiveChange} from './grid.update.js';

const containerId = 'grid-new';
const GRID_COLS = 13;

function getGridCols() {
  return 13;
}

const gridViewMode = {
  vehicle: 'simple',
  connectivity: 'fixed',
  state: 'simple',
  orders: 'detail',
  nodes: 'fixed'
};

export function renderSummaryFromBackend(summary) {
  const el = document.getElementById('fleet-op-summary');
  if (!el) return;

  el.innerHTML = `
    <div>En base: ${summary.idle}</div>
    <div>En viaje: ${summary.delivering}</div>
    <div>Inactivos: ${summary.inactive}</div>
  `;
}

function renderGridHeader() {  
  return `
    <div class="item grid-header"></div>


    <div class="item grid-header"></div>


    <div class="item grid-header">
      <img 
        src="/assets/images/icons/signal_w.png"
        class="grid-header-icon header-icon-signal"
        title="Señal"
        alt="Señal"
      >
    </div>
    <div class="item grid-header">
      <img 
        src="/assets/images/icons/activity_w.png"
        class="grid-header-icon header-icon-activity"
        title="Movimiento"
        alt="Movimiento"
      >
    </div>


    <div class="item grid-header"></div>



    <div class="item grid-header">
      <img 
        src="/assets/images/icons/warehouse_w.png"
        class="grid-header-icon header-icon-base"
        title="En Base"
        alt="En Base"
      >
    </div>
    <div class="item grid-header">
      <img 
        src="/assets/images/icons/street_w.png"
        class="grid-header-icon header-icon-street"
        title="En Calle"
        alt="En Calle"
      >
    </div>
    <div class="item grid-header">
      <img 
        src="/assets/images/icons/customer_w.png"
        class="grid-header-icon header-icon-customer"
        title="En Cliente"
        alt="En Cliente"
      >
    </div>


    <div class="item grid-header"></div>


    <div class="item grid-header">
      <img 
        src="/assets/images/icons/orders_flow_w.png"
        class="grid-header-icon header-icon-boxes"
        title="Pedidos"
        alt="Pedidos"
      >
    </div>
    <div class="item grid-header">
      <img 
        src="/assets/images/icons/orders_assignment_w.png"
        class="grid-header-icon header-icon-assigment"
        title="Pedidos Asignados"
        alt="Pedidos Asignados"
      >
    </div>
    <div class="item grid-header">
      <img
        src="/assets/images/icons/orders_loaded_w.png"
        class="grid-header-icon header-icon-loaded"
        title="Pedidos Cargados"
        alt="Pedidos Cargados"
      >
    </div>
    <div class="item grid-header">
      <img
        src="/assets/images/icons/orders_delivered_w.png"
        class="grid-header-icon header-icon-delivered"
        title="Pedidos Entregados"
        alt="Pedidos Entregados"
      >
    </div>

  `;
}

function renderEmptyCells(count) {
  return Array.from(
    { length: count },
    () => '<div class="item"></div>'
  ).join('');
}

function renderInactiveRow(u) {  
  return `        
    <div class="item vehicle-name vehicle-inactive" data-row-unit="${u.unit_id}">
      Vehículo ${u.vehicle_id}
    </div>        
    ${renderEmptyCells(getGridCols() - 1)}
  `;
}

function renderActiveRow(u, maxTotal, gridBase) {  
  const unit = {
    ...u,
  };

  return `        
    <div class="item vehicle-name vehicle-active" data-row-unit="${unit.unit_id}" data-unit="${unit.unit_id}">
       Vehículo ${unit.vehicle_id}
    </div>

    <div class="item item-separator"></div>

    <div class="item item-signal">
      ${renderSignalCell(unit)}
    </div>

    <div class="item item-motion">
      ${renderMotionCell(unit)}
    </div>

    <div class="item item-separator"></div>

    <div class="item item-state">
      ${renderStateSlot(unit, 'base')}
    </div>

    <div class="item item-state">
      ${renderStateSlot(unit, 'street')}
    </div>

    <div class="item item-state">
      ${renderStateSlot(unit, 'client')}
    </div>

    <div class="item item-separator"></div>

    <div class="item item-bars">
      ${renderOrdersCell(unit, maxTotal, gridViewMode)}
    </div>

    <div class="item item-orders-value item-orders-assigned">
      ${unit.orders_assigned || 0}
    </div>

    <div class="item item-orders-value item-orders-loaded">
      ${unit.orders_loaded || 0}
    </div>

    <div class="item item-orders-value item-orders-delivered">
      ${unit.orders_delivered || 0}
    </div>

  `;
}

function replaceGridRow(container, unitId, rowHtml) {  

  const gridCols = getGridCols();
  const firstCell = container.querySelector(`[data-row-unit="${unitId}"]`);
  if (!firstCell) return false;

  const template = document.createElement('template');
  template.innerHTML = rowHtml.trim();

  const newCells = Array.from(template.content.children);

  if (newCells.length !== gridCols) {  
    console.warn('Cantidad de celdas inválida para fila:', unitId, newCells.length);
    return false;
  }

  let currentCell = firstCell;

  for (let i = 0; i < gridCols; i++) {  
    if (!currentCell) return false;

    const nextCell = currentCell.nextElementSibling;
    currentCell.replaceWith(newCells[i]);
    currentCell = nextCell;
  }

  return true;
}

export function renderGrid(units, base) {
    
    const container = document.getElementById(containerId);
    if (!container) return;

    const gridUnits = USE_GRID_MOCK ? mockUnits : units;
    const gridBase = USE_GRID_MOCK ? mockBase : base;      

    let hasAnyChange = false;
    let hasAnyActiveChange = false;

    gridUnits.forEach(unit => {
      const prev = getLastUnit(unit.unit_id);

      if (hasUnitChanged(prev, unit)) {
        hasAnyChange = true;

        if (hasActiveChanged(prev, unit)) {
          hasAnyActiveChange = true;
        }
      }
    });

    if (!hasAnyChange) {
      return;
    }
    const changedUnitsWithoutActiveChange =
      getChangedUnitsWithoutActiveChange(getLastUnit, gridUnits);

    setLastUnits(gridUnits);

    if (!hasAnyActiveChange) {
        const maxTotal = Math.max(...gridUnits.map(u => {
          return (u.orders_assigned || 0) + (u.orders_loaded || 0) + (u.orders_delivered || 0);
        }), 1);

        changedUnitsWithoutActiveChange.forEach(u => {
          const rowHtml = u.active === 1            
            ? renderActiveRow(u, maxTotal, gridBase)
            : renderInactiveRow(u);

          replaceGridRow(container, u.unit_id, rowHtml);
        
        });

        //renderKPIs(gridUnits);
        syncGridSelection();
        bindGridEvents(container);
        return;
    }
        
    let html = `<div class="grid-container-geo">`;
    html += renderGridHeader();

    const maxTotal = Math.max(...gridUnits.map(u => {  
      return (u.orders_assigned || 0) + (u.orders_loaded || 0) + (u.orders_delivered || 0);
    }), 1);    
    
    //  DATOS    
    gridUnits.forEach(u => {

      const unit = {
        ...u,
      };
        
        // ---------------------------  DATOS DE LA GRILLA  ----------------
        // * INACTIVOS *
        if (u.active !== 1) {
            html += renderInactiveRow(u);
            return;
        }
        // * ACTIVOS *        
        html += renderActiveRow(u, maxTotal, gridBase);
        // -------------------------------------------------------------------
    });
    html += '</div>';    
    // renderKPIs(gridUnits);  
    // console.log('[GRID] render completo');
    container.innerHTML = html;      
    // ------------------------------------ FOCO Y SEGUMIENTO DE UN MARKER ----------------------
    syncGridSelection();
    bindGridEvents(container);
    // -------------------------------------------------------------------------------------------
}
