export function renderRealtimeDashboard(json) {
  if (!json) return;

  window.renderGrid(json.units, json.base);
  window.renderVehiculosChart(json);
  window.renderPedidosChart(json);
}