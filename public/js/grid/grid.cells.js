export function renderSignalCell(u) {
  const noSignal = ['STALE', 'NO_DATA', 'OFFLINE'].includes(u.tech_state);

  // FUTURO:
// Hoy la grilla usa solo 2 iconos de señal:
// - signal-ok.png: señal normal
// - signal-no.png: señal atrasada / sin datos / offline
//
// No agregar todavía un tercer icono de alerta.
// La alerta real debería calcularse combinando:
// tiempo sin señal + ubicación + pedidos activos + criticidad operativa.
  const img = noSignal
    ? '/assets/images/grid/signal-no.png'
    : '/assets/images/grid/signal-ok.png';

  const signalImgClass = noSignal ? 'signal-img-no' : 'signal-img-ok';  

  const label =
    u.tech_state === 'NO_DATA' ? "+2'" :
    u.tech_state === 'OFFLINE' ? "+6'" :
    '';

  return `
    <div class="signal-cell" title="${u.tech_state}">      
      <img src="${img}" class="signal-img ${signalImgClass}" alt="${u.tech_state}">
      ${label ? `<span class="signal-label">${label}</span>` : ''}
    </div>
  `;
}



export function renderMotionCell(u) {

    const isMoving = u.tech_state === 'MOVING';

    const img = isMoving
      ? '/assets/images/grid/moving.png'
      : '/assets/images/grid/stopped.png';      

    const moveClass = isMoving ? 'move-ok' : 'move-stop';

    const label =
      u.tech_state === 'STOPPED_MEDIUM' ? "+3'" :
      u.tech_state === 'STOPPED_LONG' ? "+6'" :
      '';

    return `
      <div class="motion-cell" title="${u.tech_state}">
        <img 
          src="${img}" 
          class="move-img ${moveClass}" 
          alt="${u.tech_state}"
        >
        ${label ? `<span class="motion-label">${label}</span>` : ''}
      </div>
    `;
}


export function renderStateSlot(u, slot) {
  const isActive =
    (slot === 'base' && u.state === 'base') ||
    (slot === 'street' && u.state === 'street') ||
    (slot === 'client' && u.state === 'client');

  if (!isActive) return '';

  return `
    <img 
      src="/assets/images/grid/location.png" 
      class="location-img" 
      title="${slot}"
      alt="${slot}" 
    >
  `;
}

export function renderOrdersCell(u, maxTotal, gridViewMode) {
  const A = u.orders_assigned || 0;   // asignados pendientes
  const C = u.orders_loaded || 0;     // cargados
  const E = u.orders_delivered || 0;  // entregados

  if (gridViewMode.orders === 'simple') {
    return `<div class="orders-simple">${A} / ${C} / ${E}</div>`;
  }

  const total = A + C + E || 1;

  const pDelivered = (E / total) * 100;
  const pLoaded = (C / total) * 100;
  const pPending = (A / total) * 100;

  return `
    <div class="bar-seg" title="Pendientes: ${A} | Cargados: ${C} | Entregados: ${E}">
      <div class="seg cliente" style="width:${pDelivered}%"></div>
      <div class="seg camion" style="width:${pLoaded}%"></div>
      <div class="seg base" style="width:${pPending}%"></div>
    </div>
  `;  
}
// ---------------------------------------------------------------------------------------------
export function renderTimeline(u, base) {
  let clients = u.clients || [];

  const baseLat = base?.lat;
  const baseLng = base?.lng;

  if (u.active === 1 && baseLat != null && baseLng != null && clients.length > 0) {
    clients = [...clients].sort((a, b) => {
      const dA = (a.lat - baseLat) ** 2 + (a.lng - baseLng) ** 2;
      const dB = (b.lat - baseLat) ** 2 + (b.lng - baseLng) ** 2;
      return dA - dB;
    });
  }

  let dots = '';

  clients.forEach(c => {
    const isDelivered = c.status === 40;
    dots += `<div class="dot ${isDelivered ? 'dot-delivered' : ''}"></div>`;
  });

  return `
    <div class="timeline">
      <div class="line">
        ${dots}
      </div>
    </div>
  `;
}