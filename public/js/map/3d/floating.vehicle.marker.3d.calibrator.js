import {
  setFloatingVehicle3DPosition,
  setFloatingVehicle3DBearing,
  setFloatingVehicle3DVisible,
  setFloatingVehicle3DCalibration
} from './floating.vehicle.marker.3d.js';

const DEFAULT_VALUES_DEG = {
  rotationX: 90,
  rotationY: 0,
  rotationZ: 0,
  bearingOffsetDeg: 0
};
const ROTATION_STEPS_DEG = [-90, -45, -15, 15, 45, 90];
const ABSOLUTE_BEARINGS_DEG = [0, 90, 180, 270];
const calibrators = new WeakMap();

function applyCalibration(map, values) {
  setFloatingVehicle3DCalibration(map, {
    rotationX: values.rotationX * Math.PI / 180,
    rotationY: values.rotationY * Math.PI / 180,
    rotationZ: values.rotationZ * Math.PI / 180,
    bearingOffsetDeg: values.bearingOffsetDeg
  });
}

function configurationText(values) {
  return [
    `const VEHICLE_MODEL_ROTATION_X = ${values.rotationX * Math.PI / 180};`,
    `const VEHICLE_MODEL_ROTATION_Y = ${values.rotationY * Math.PI / 180};`,
    `const VEHICLE_MODEL_ROTATION_Z = ${values.rotationZ * Math.PI / 180};`,
    `const VEHICLE_MODEL_BEARING_OFFSET_DEG = ${values.bearingOffsetDeg};`
  ].join('\n');
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

function createStepButtons(name) {
  return ROTATION_STEPS_DEG.map(step => `
    <button type="button" data-control="${name}" data-step="${step}">
      ${step > 0 ? '+' : ''}${step}°
    </button>
  `).join('');
}

export function initFloatingVehicle3DCalibrator(map) {
  if (calibrators.has(map)) return;

  const values = { ...DEFAULT_VALUES_DEG };
  const panel = document.createElement('section');
  panel.dataset.floatingVehicle3DCalibrator = 'dev';
  panel.style.cssText = [
    'position:absolute',
    'z-index:20',
    'top:8px',
    'left:8px',
    'width:310px',
    'padding:10px',
    'border:1px solid #f59e0b',
    'border-radius:6px',
    'background:rgba(17,24,39,.94)',
    'color:#f9fafb',
    'font:12px/1.35 monospace',
    'box-shadow:0 4px 14px rgba(0,0,0,.35)'
  ].join(';');
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong style="color:#fbbf24">DEV · Vehículo GLB</strong>
      <button type="button" data-action="remove" title="Quitar calibrador">×</button>
    </div>
    ${['rotationX', 'rotationY', 'rotationZ', 'bearingOffsetDeg'].map(name => `
      <div style="margin-bottom:7px">
        <div><span>${name}</span>: <strong data-value="${name}"></strong>°</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap">${createStepButtons(name)}</div>
      </div>
    `).join('')}
    <div style="margin-bottom:8px">
      <div>Bearing absoluto</div>
      <div style="display:flex;gap:4px">
        ${ABSOLUTE_BEARINGS_DEG.map(bearing => `
          <button type="button" data-bearing="${bearing}">${bearing}°</button>
        `).join('')}
      </div>
    </div>
    <div style="display:flex;gap:6px">
      <button type="button" data-action="reset">Reset</button>
      <button type="button" data-action="copy">Copiar configuración</button>
      <span data-copy-status></span>
    </div>
  `;

  const updateValues = () => {
    Object.entries(values).forEach(([name, value]) => {
      const output = panel.querySelector(`[data-value="${name}"]`);
      if (output) output.textContent = String(value);
    });
  };

  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !panel.contains(button)) return;

    if (button.dataset.control) {
      values[button.dataset.control] += Number(button.dataset.step);
      updateValues();
      applyCalibration(map, values);
      return;
    }

    if (button.dataset.bearing != null) {
      setFloatingVehicle3DBearing(map, Number(button.dataset.bearing));
      return;
    }

    if (button.dataset.action === 'reset') {
      Object.assign(values, DEFAULT_VALUES_DEG);
      updateValues();
      applyCalibration(map, values);
      setFloatingVehicle3DBearing(map, 0);
      return;
    }

    if (button.dataset.action === 'copy') {
      const status = panel.querySelector('[data-copy-status]');
      copyText(configurationText(values))
        .then(() => {
          if (status) status.textContent = 'Copiado';
        })
        .catch(() => {
          if (status) status.textContent = 'Error';
        });
      return;
    }

    if (button.dataset.action === 'remove') {
      panel.remove();
      calibrators.delete(map);
    }
  });

  calibrators.set(map, { panel, values });
  map.getContainer().appendChild(panel);
  updateValues();
  applyCalibration(map, values);

  const center = map.getCenter();
  setFloatingVehicle3DPosition(map, { lat: center.lat, lng: center.lng });
  setFloatingVehicle3DVisible(map, true);
}
