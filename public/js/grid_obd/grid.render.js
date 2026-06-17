import { bindGridEvents, syncGridSelection } from './grid.events.js';
//import { renderKPIs } from '../ui/kpi.render.js';

import { 
  USE_GRID_MOCK, 
  mockBase, 
  mockUnits,
  USE_OBD_MOCK,
  mockObdByVehicleId
} from './grid.mock.js';

import {
  renderSignalCell,
  renderMotionCell,
  renderStateSlot,
  renderOrdersCell,
  renderObdFuelCell,
  renderObdTempCell,
  renderObdMotorCell,
  renderTimeline
} from './grid.cells.js';

import { getLastUnit, setLastUnits } from './grid.store.js';
import { hasUnitChanged, hasActiveChanged, getChangedUnitsWithoutActiveChange} from './grid.update.js';

const containerId = 'grid-new';
const GRID_COLS = 15;

function getGridCols(usesObd) {
  return usesObd ? 15 : 11;
}

const gridViewMode = {
  vehicle: 'simple',
  connectivity: 'fixed',
  state: 'simple',
  orders: 'detail',
  nodes: 'fixed',
  obd: 'simple'
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

function renderGridHeader(usesObd) {  
  return `
    <div class="item grid-header"></div>

    <div class="item grid-header"></div>

    <div class="item grid-header">
      <img 
        src="/assets/images/grid/signal.png"       
        class="grid-header-icon header-icon-signal"
        title="Señal"
        alt="Señal"
      >
    </div>

    <div class="item grid-header">
      <img 
        src="/assets/images/grid/activity.png"       
        class="grid-header-icon header-icon-activity"
        title="Movimiento"
        alt="Movimiento"
      >
    </div>

    <div class="item grid-header"></div>



    <div class="item grid-header">
      <img 
        src="/assets/images/grid/base-24.png"       
        class="grid-header-icon header-icon-base"
        title="En Base"
        alt="En Base"
      >
    </div>
    <div class="item grid-header">
      <img 
        src="/assets/images/grid/street-24.png"       
        class="grid-header-icon header-icon-street"
        title="En Calle"
        alt="En Calle"
      >
    </div>
    <div class="item grid-header">
      <img 
        src="/assets/images/grid/customer.png"       
        class="grid-header-icon header-icon-customer"
        title="En Cliente"
        alt="En Cliente"
      >
    </div>   
    
    

    <div class="item grid-header"></div>

    <div class="item grid-header">
      <img 
        src="/assets/images/grid/boxes.png"       
        class="grid-header-icon header-icon-boxes"
        title="Pedidos"
        alt="Pedidos"
      >
    </div>
   
    <div class="item grid-header">
      <img 
        src="/assets/images/grid/route.png"       
        class="grid-header-icon header-icon-route"
        title="Ruta"
        alt="Ruta"
      >
    </div>         

    ${usesObd ? `

      <div class="item grid-header"></div>

      <div class="item grid-header">
        <img 
          src="/assets/images/grid/engine.png"       
          class="grid-header-icon header-icon-engine"
          title="Motor"
          alt="Motor"
        >
      </div>

      <div class="item grid-header">
        <img 
          src="/assets/images/grid/fuel-0.png"       
          class="grid-header-icon header-icon-fuel"
          title="Combustible"
          alt="Combustible"
        >
      </div>   

      <div class="item grid-header">
        <img 
          src="/assets/images/grid/temp-0.png"       
          class="grid-header-icon header-icon-temp"
          title="Temperatura"
          alt="Temperatura"
        >    
      </div>
    ` : ''}

  `;
}

function renderEmptyCells(count) {
  return Array.from(
    { length: count },
    () => '<div class="item"></div>'
  ).join('');
}

function renderInactiveRow(u, usesObd) {  
  return `        
    <div class="item vehicle-name vehicle-inactive" data-row-unit="${u.unit_id}">
      Vehículo ${u.vehicle_id}
    </div>    
    ${renderEmptyCells(getGridCols(usesObd) - 1)}
  `;
}

function renderActiveRow(u, maxTotal, gridBase, usesObd) {  
  const unit = {
    ...u,
    obd: (
      USE_OBD_MOCK &&
      mockObdByVehicleId[u.vehicle_id] &&
      (!u.obd || u.obd.fuel_level === null)
    )
      ? mockObdByVehicleId[u.vehicle_id]
      : u.obd
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

    <div class="item item-timeline">
      ${renderTimeline(unit, gridBase)}
    </div>

    ${usesObd ? `
        <div class="item item-separator"></div>

        <div class="item item-motor">
          ${renderObdMotorCell(unit)}
        </div>

        <div class="item item-obd item-obd-fuel">
          ${renderObdFuelCell(unit)}
        </div>

        <div class="item item-obd item-obd-temp">
          ${renderObdTempCell(unit)}
        </div>
    ` : ''}
  `;
}

function replaceGridRow(container, unitId, rowHtml, usesObd) {  

  const gridCols = getGridCols(usesObd);
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

function renderGrid(units, base) {  

    const usesObd = window.AppConfig?.usesObd === true;
    
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
            ? renderActiveRow(u, maxTotal, gridBase, usesObd)
            : renderInactiveRow(u, usesObd);

          replaceGridRow(container, u.unit_id, rowHtml, usesObd);
          // console.log('[GRID] reemplaza fila', u.unit_id);
        });

        //renderKPIs(gridUnits);
        syncGridSelection();
        bindGridEvents(container);
        return;
    }
        
    let html = `<div class="grid-container-geo ${usesObd ? 'grid-with-obd' : 'grid-no-obd'}">`;
    
    html += renderGridHeader(usesObd);

    const maxTotal = Math.max(...gridUnits.map(u => {  
      return (u.orders_assigned || 0) + (u.orders_loaded || 0) + (u.orders_delivered || 0);
    }), 1);    
    
    //  DATOS    
    gridUnits.forEach(u => {

      const unit = {
        ...u,
        obd: (
          USE_OBD_MOCK &&
          mockObdByVehicleId[u.vehicle_id] &&
          (!u.obd || u.obd.fuel_level === null)
        )
          ? mockObdByVehicleId[u.vehicle_id]
          : u.obd
      };
        
        // ---------------------------  DATOS DE LA GRILLA  ----------------
        // * INACTIVOS *
        if (u.active !== 1) {
            html += renderInactiveRow(u, usesObd);
            return;
        }
        // * ACTIVOS *        
        html += renderActiveRow(u, maxTotal, gridBase, usesObd);
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
window.renderGrid = renderGrid;