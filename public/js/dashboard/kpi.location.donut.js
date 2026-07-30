export function renderLocationDonut(json) {
  const v = json?.kpi_summary?.vehicles;
  if (!v) return;

  const baseValue = Number(v.in_base || 0);
  const streetValue = Number(v.in_street || 0);
  const clientValue = Number(v.in_client || 0);

  const total = Number(v.active || 0);

  const totalEl = document.getElementById('kpi-veh-total-location-main');
  const baseEl = document.getElementById('kpi-veh-base-main');
  const streetEl = document.getElementById('kpi-veh-calle-main');
  const clientEl = document.getElementById('kpi-veh-cliente-main');

  const baseBar = document.getElementById('kpi-veh-base-bar');
  const streetBar = document.getElementById('kpi-veh-calle-bar');
  const clientBar = document.getElementById('kpi-veh-cliente-bar');

  if (totalEl) totalEl.textContent = total;
  if (baseEl) baseEl.textContent = baseValue;
  if (streetEl) streetEl.textContent = streetValue;
  if (clientEl) clientEl.textContent = clientValue;

  const safeTotal = total > 0 ? total : 1;

  if (baseBar) baseBar.style.width = `${(baseValue / safeTotal) * 100}%`;
  if (streetBar) streetBar.style.width = `${(streetValue / safeTotal) * 100}%`;
  if (clientBar) clientBar.style.width = `${(clientValue / safeTotal) * 100}%`;
}