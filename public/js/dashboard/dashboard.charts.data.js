import { updateDeliveryCharts, updateBaseCharts} from '../charts/operational.charts.js';

let chartsIntervalId = null;
let isLoadingCharts = false;

const DELIVERY_CHARTS_URL = '/api/dashboard/get_operational_charts.php';
//const DELIVERY_CHARTS_REFRESH_MS = 30000;

export async function refreshDashboardCharts() {
  if (isLoadingCharts) return;

  isLoadingCharts = true;

  try {
    const res = await fetch(DELIVERY_CHARTS_URL);

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    if (!data || data.ok !== true) {
      return;
    }

    updateDeliveryCharts(data);
    updateBaseCharts(data);

  } catch (e) {
    console.error('[DASHBOARD-CHARTS-ERROR]', e);
  } finally {
    isLoadingCharts = false;
  }
}

export function startDashboardChartsPolling() {
  refreshDashboardCharts();
}

export function stopDashboardChartsPolling() {
  // Sin intervalo propio: los charts se refrescan desde el tick principal
}