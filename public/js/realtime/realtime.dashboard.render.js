import { renderKPIs } from '../ui/kpi.render.js';
import { renderSignalMiniChart, renderActivityMiniChart, renderLocationChart, renderOrdersChart } from '../charts/kpi.charts.js';
import { initStreetRhythmChart, initStreetAccumChart } from '../charts/operational.charts.js';

export function renderRealtimeDashboard(json) {

  if (!json) return;

  renderKPIs(json.kpi_summary);

  renderSignalMiniChart(json);
  renderActivityMiniChart(json);
  renderLocationChart(json);
  renderOrdersChart(json);

  initStreetRhythmChart();
  initStreetAccumChart();

  window.renderGrid(json.units, json.base);

}