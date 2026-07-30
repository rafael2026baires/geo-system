import { renderKPIs } from '../ui/kpi.render.js';
import { renderSignalMiniChart, renderActivityMiniChart, renderLocationChart, renderOrdersChart } from '../charts/kpi.charts.js';
import { initStreetRhythmChart, initStreetAccumChart } from '../charts/operational.charts.js';
import { renderGrid } from '../grid/grid.render.js';

export function renderRealtimeDashboard(json) {

  if (!json) return;

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
