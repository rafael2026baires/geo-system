import { renderKPIs } from '../ui/kpi.render.js';
import { renderSignalMiniChart, renderActivityMiniChart, renderLocationChart, renderOrdersChart } from '../charts/kpi.charts.js';
import { initStreetRhythmChart, initStreetAccumChart } from '../charts/operational.charts.js';
import { renderGrid } from '../grid/grid.render.js';

function updateOperationalContextPulleys(units) {
  const validUnits = Array.isArray(units) ? units : [];
  const hasVehiclesInBase = validUnits.some(unit => (
    unit?.active === 1 && unit.state === 'base'
  ));
  const hasVehiclesInStreet = validUnits.some(unit => (
    unit?.active === 1 && (
      unit.state === 'street' || unit.state === 'client'
    )
  ));
  const basePulley = document.getElementById('base-context-pulley');
  const streetPulley = document.getElementById('street-context-pulley');

  basePulley?.classList.toggle('is-rotating', hasVehiclesInBase);
  streetPulley?.classList.toggle('is-rotating', hasVehiclesInStreet);
}

export function renderRealtimeDashboard(json) {

  if (!json) return;

  updateOperationalContextPulleys(json.units);

  renderKPIs(json.kpi_summary);

  renderSignalMiniChart(json);
  renderActivityMiniChart(json);
  renderLocationChart(json);
  renderOrdersChart(json);

  initStreetRhythmChart();
  initStreetAccumChart();

  const gridUnits = json.units.map(({ clients, ...unit }) => unit);
  renderGrid(gridUnits, json.base);

}
