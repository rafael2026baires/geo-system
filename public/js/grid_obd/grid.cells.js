export function renderSignalCell(u) {
  const noSignal = ['STALE', 'NO_DATA', 'OFFLINE'].includes(u.tech_state);

  const img = noSignal
    ? '/assets/images/grid/signal-no.png'
    : '/assets/images/grid/signal-ok.png';

  const label =
    u.tech_state === 'NO_DATA' ? "+2'" :
    u.tech_state === 'OFFLINE' ? "+6'" :
    '';

  return `
    <div class="signal-cell" title="${u.tech_state}">
      <img src="${img}" class="signal-img" alt="${u.tech_state}">
      ${label ? `<span class="signal-label">${label}</span>` : ''}
    </div>
  `;
}

export function renderMotionCell(u) {
  const noSignal = ['STALE', 'NO_DATA', 'OFFLINE'].includes(u.tech_state);

  if (noSignal) {
    return `
      <div class="motion-cell" title="Movimiento no disponible sin señal">
        <div class="motion-wheel motion-disabled"></div>
      </div>
    `;
  }

  const isMoving = u.tech_state === 'MOVING';

  const label =
    u.tech_state === 'STOPPED_MEDIUM' ? "+3'" :
    u.tech_state === 'STOPPED_LONG' ? "+6'" :
    '';

  return `
    <div class="motion-cell" title="${u.tech_state}">
      <div class="motion-wheel ${isMoving ? 'motion-spinning' : ''}"></div>
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
      src="/assets/images/grid/truck.png" 
      class="truck-img" 
      title="${slot}"
      alt="${slot}"
    >
  `;
}

export function renderOrdersCell(u, maxTotal, gridViewMode) {
  const A = u.orders_assigned || 0;
  const C = u.orders_loaded || 0;
  const E = u.orders_delivered || 0;

  if (gridViewMode.orders === 'simple') {
    return `<div class="orders-simple">${A} / ${C} / ${E}</div>`;
  }

  const total = A + C + E || 1;
  const pA = (A / total) * 100;
  const pC = (C / total) * 100;
  const pE = (E / total) * 100; 

  return `
    <div class="bar-seg">
      <div class="seg base" style="width:${pA}%"></div>
      <div class="seg camion" style="width:${pC}%"></div>
      <div class="seg cliente" style="width:${pE}%"></div>
    </div>
  `;  
}
// -------------------------------------  OBD  ----------------------------
function renderSimpleBar(value, max) {
  if (value === null || value === undefined) return '';

  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));

  return `
    <div class="obd-bar">
      <div class="obd-fill" style="width:${pct}%"></div>
    </div>
  `;
}

function renderObdNoData(title) {
  return `
    <img 
      src="/assets/images/grid/no-data.png" 
      class="obd-no-data-icon" 
      title="${title}"
      alt="${title}"
    >
  `;
}

export function renderObdFuelCell(u) {

  const obd = u.obd || null;

  if (!obd || obd.fuel_level === null || obd.fuel_level === undefined) {
    return `
      <div class="obd-single">
        <img 
          src="/assets/images/grid/fuel.png" 
          class="obd-icon" 
          title="Combustible"
          alt="Combustible"
        >
        ${renderObdNoData('Sin dato de combustible')}
      </div>
    `;
  }

  return `
    <div class="obd-single">
      <img 
        src="/assets/images/grid/fuel.png" 
        class="obd-icon" 
        title="Combustible"
        alt="Combustible"
      >
      ${renderSimpleBar(obd.fuel_level, 100)}
    </div>
  `;
}

export function renderObdTempCell(u) {

  const obd = u.obd || null;

  if (!obd || obd.engine_temp === null || obd.engine_temp === undefined) {
    return `
      <div class="obd-single">
        <img 
          src="/assets/images/grid/temp.png" 
          class="obd-icon" 
          title="Temperatura"
          alt="Temperatura"
        >
        ${renderObdNoData('Sin dato de temperatura')}
      </div>
    `;
  }

  return `
    <div class="obd-single">
      <img 
        src="/assets/images/grid/temp.png" 
        class="obd-icon" 
        title="Temperatura"
        alt="Temperatura"
      >
      ${renderSimpleBar(obd.engine_temp, 120)}
    </div>
  `;
}

export function renderObdMotorCell(u) {

  const obd = u.obd || null;

  if (!obd || obd.engine_on === null || obd.engine_on === undefined) {
    return `
      <div class="motor-cell">
        <img 
          src="/assets/images/grid/no-data.png" 
          class="motor-img"           
          title="Sin dato de motor"
          alt="Sin dato de motor"
        >
      </div>
    `;
  }

  const img = obd.engine_on
    ? '/assets/images/grid/signal-ok.png'
    : '/assets/images/grid/signal-no.png';

  const title = obd.engine_on ? 'Motor encendido' : 'Motor apagado';

  return `
    <div class="motor-cell">
      <img 
        src="${img}" 
        class="motor-img" 
        title="${title}"
        alt="${title}"
      >
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