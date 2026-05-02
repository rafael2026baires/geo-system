export function renderKPIs(units) {

  const total = units.length;

  const activos = units.filter(u => u.active === 1).length;

  const enTransito = units.filter(u => u.state === 'street').length;

  const conSenal = units.filter(u => u.tech_state !== 'OFFLINE').length;

  const pendientes = units.reduce((acc, u) => {
    const A = u.orders_assigned || 0;
    const C = u.orders_loaded || 0;
    return acc + A + C;
  }, 0);

  // -------- DOM --------

  const elActivos = document.getElementById('kpi-activos');
  if (elActivos) {
    elActivos.querySelector('.kpi-main').textContent = activos;
    elActivos.querySelector('.kpi-total').textContent = `/${total}`;
  }

  const elTransito = document.getElementById('kpi-transito');
  if (elTransito) {
    elTransito.querySelector('.kpi-main').textContent = enTransito;
  }

  const elSenal = document.getElementById('kpi-senal');
  if (elSenal) {
    elSenal.querySelector('.kpi-main').textContent = conSenal;
  }

  const elPendientes = document.getElementById('kpi-pendientes');
  if (elPendientes) {
    elPendientes.querySelector('.kpi-main').textContent = pendientes;
  }
  
}