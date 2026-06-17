import { renderLocationDonut } from '../dashboard/kpi.location.donut.js';
import { renderOrdersDonut } from '../dashboard/kpi.orders.donut.js';

export function renderSignalMiniChart(json) {
  const v = json?.kpi_summary?.vehicles;
  if (!v) return;

  const items = [
    { id: 'bar-signal-ok', value: v.signal_ok || 0 },
    { id: 'bar-signal-nodata', value: v.signal_nodata || 0 },
    { id: 'bar-signal-alert', value: v.signal_alert || 0 }
  ];

  renderInternalBars(items);
}

export function renderActivityMiniChart(json) {
  const v = json?.kpi_summary?.vehicles;
  if (!v) return;

  const items = [
    { id: 'bar-activity-moving', value: v.activity_moving || 0 },
    { id: 'bar-activity-stopped', value: v.activity_stopped || 0 },
    { id: 'bar-activity-alert', value: v.activity_alert || 0 }
  ];

  renderInternalBars(items);
}

export function renderLocationChart(json) {
  renderLocationDonut(json);
}

export function renderOrdersChart(json) {
  renderOrdersDonut(json);
}

function renderInternalBars(items, total = null) {
  const maxValue = total !== null
    ? Number(total || 0)
    : Math.max(...items.map(item => Number(item.value || 0)), 0);

  items.forEach(item => {
    const el = document.getElementById(item.id);
    if (!el) return;

    const value = Number(item.value || 0);
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;

    el.style.width = `${pct}%`;
  });
}