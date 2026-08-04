import {
  FLOATING_MAP_LOCATION_SCALE_PROFILE,
  FLOATING_MAP_LOGISTICS_BASE_SCALE_PROFILE,
  FLOATING_MAP_VEHICLE_SCALE_PROFILE,
  MAIN_MAP_LOCATION_SCALE_PROFILE,
  MAIN_MAP_LOGISTICS_BASE_SCALE_PROFILE,
  MAIN_MAP_VEHICLE_SCALE_PROFILE
} from './map.3d.scale.config.js';
import {
  clearTemporaryZoomScaleOverride,
  resolveZoomScaleFactor,
  resolveZoomScaleFactorWithoutOverride,
  setTemporaryZoomScaleOverride
} from './map.3d.scale.js';

const STORAGE_KEY = 'geo-system:dev:map-3d-scale-calibrator:v1';
const STYLE_ATTRIBUTE = 'data-map-3d-calibrator';
const ELEMENT_OPTIONS = Object.freeze([
  Object.freeze({ value: 'base', label: 'Base' }),
  Object.freeze({ value: 'vehicles', label: 'Vehículos' }),
  Object.freeze({ value: 'locations', label: 'Locations' })
]);
const MAP_OPTIONS = Object.freeze([
  Object.freeze({ value: 'main', label: 'Principal' }),
  Object.freeze({ value: 'floating', label: 'Secundario' })
]);
const PROFILE_CATALOG = Object.freeze([
  Object.freeze({
    key: 'base:main',
    element: 'base',
    map: 'main',
    profile: MAIN_MAP_LOGISTICS_BASE_SCALE_PROFILE
  }),
  Object.freeze({
    key: 'base:floating',
    element: 'base',
    map: 'floating',
    profile: FLOATING_MAP_LOGISTICS_BASE_SCALE_PROFILE
  }),
  Object.freeze({
    key: 'vehicles:main',
    element: 'vehicles',
    map: 'main',
    profile: MAIN_MAP_VEHICLE_SCALE_PROFILE
  }),
  Object.freeze({
    key: 'vehicles:floating',
    element: 'vehicles',
    map: 'floating',
    profile: FLOATING_MAP_VEHICLE_SCALE_PROFILE
  }),
  Object.freeze({
    key: 'locations:main',
    element: 'locations',
    map: 'main',
    profile: MAIN_MAP_LOCATION_SCALE_PROFILE
  }),
  Object.freeze({
    key: 'locations:floating',
    element: 'locations',
    map: 'floating',
    profile: FLOATING_MAP_LOCATION_SCALE_PROFILE
  })
]);

let calibratorState = null;

function isUsableMap(map) {
  return Boolean(
    map &&
    typeof map.getZoom === 'function' &&
    typeof map.triggerRepaint === 'function' &&
    typeof map.on === 'function' &&
    typeof map.off === 'function' &&
    (
      typeof map.easeTo === 'function' ||
      typeof map.jumpTo === 'function'
    )
  );
}

function copyPoints(points) {
  return points.map(point => ({
    zoom: Number(point.zoom),
    factor: Number(point.factor)
  }));
}

function normalizePoints(points) {
  if (!Array.isArray(points)) return null;

  const normalized = points.map(point => ({
    zoom: Number(point?.zoom),
    factor: Number(point?.factor)
  }));

  normalized.sort((left, right) => left.zoom - right.zoom);

  if (normalized.length < 2) return null;

  const isValid = normalized.every((point, index) => (
    Number.isFinite(point.zoom) &&
    Number.isFinite(point.factor) &&
    point.factor > 0 &&
    (index === 0 || point.zoom > normalized[index - 1].zoom)
  ));

  return isValid ? normalized : null;
}

function normalizeZoom(zoom) {
  return Math.round(Number(zoom) * 10) / 10;
}

function normalizeFactor(factor) {
  return Math.round(Number(factor) * 10000) / 10000;
}

function formatNumber(value, maximumFractionDigits = 4) {
  return Number(value).toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits
  });
}

function readStorage() {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return { combinations: {} };

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') {
      return { combinations: {} };
    }

    return {
      combinations:
        parsed.combinations && typeof parsed.combinations === 'object'
          ? parsed.combinations
          : {}
    };
  } catch {
    return { combinations: {} };
  }
}

function writeStoredCombination(entry, points) {
  try {
    const storage = readStorage();
    storage.combinations[entry.key] = {
      element: entry.element,
      map: entry.map,
      points: copyPoints(points),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return true;
  } catch {
    return false;
  }
}

function removeStoredCombination(key) {
  try {
    const storage = readStorage();
    delete storage.combinations[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return true;
  } catch {
    return false;
  }
}

function clearStoredCombinations() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function loadPointsForEntry(entry) {
  const stored = readStorage().combinations[entry.key];
  if (
    stored?.element !== entry.element ||
    stored?.map !== entry.map
  ) {
    return copyPoints(entry.profile.points);
  }

  return normalizePoints(stored.points) || copyPoints(entry.profile.points);
}

function findCatalogEntry(element, map) {
  return PROFILE_CATALOG.find(entry => (
    entry.element === element && entry.map === map
  ));
}

function getSelectedMap(state, entry = state.activeEntry) {
  return entry.map === 'main' ? state.mainMap : state.floatingMap;
}

function createStyle() {
  const style = document.createElement('style');
  style.setAttribute(STYLE_ATTRIBUTE, '');
  style.textContent = `
    .map3d-calibrator-panel {
      position: fixed;
      z-index: 10000;
      top: 48px;
      left: 700px;
      right: auto;
      width: 350px;
      max-height: calc(100vh - 64px);
      overflow: auto;
      box-sizing: border-box;
      padding: 10px;
      border: 1px solid #4b5563;
      border-radius: 6px;
      background: #111827;
      color: #e5e7eb;
      box-shadow: 0 6px 18px #00000066;
      font: 12px/1.35 Consolas, monospace;
    }
    .map3d-calibrator-panel * { box-sizing: border-box; }
    .map3d-calibrator-panel button,
    .map3d-calibrator-panel input,
    .map3d-calibrator-panel select,
    .map3d-calibrator-panel textarea {
      border: 1px solid #4b5563;
      border-radius: 4px;
      background: #1f2937;
      color: #e5e7eb;
      font: inherit;
    }
    .map3d-calibrator-panel button { padding: 4px 7px; cursor: pointer; }
    .map3d-calibrator-panel button:hover { background: #374151; }
    .map3d-calibrator-header,
    .map3d-calibrator-row,
    .map3d-calibrator-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .map3d-calibrator-header { justify-content: space-between; margin-bottom: 8px; }
    .map3d-calibrator-header strong { color: #fbbf24; }
    .map3d-calibrator-row { margin-bottom: 7px; }
    .map3d-calibrator-row label { flex: 1; }
    .map3d-calibrator-row select,
    .map3d-calibrator-row input { width: 155px; padding: 4px; }
    .map3d-calibrator-metrics {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3px 8px;
      margin: 8px 0;
      padding: 7px;
      background: #0f172a;
      border-radius: 4px;
    }
    .map3d-calibrator-points {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
      margin: 7px 0;
    }
    .map3d-calibrator-points button[aria-pressed="true"] {
      border-color: #f59e0b;
      color: #fbbf24;
    }
    .map3d-calibrator-actions { flex-wrap: wrap; margin: 7px 0; }
    .map3d-calibrator-output { width: 100%; min-height: 112px; padding: 6px; resize: vertical; }
    .map3d-calibrator-status { min-height: 16px; color: #93c5fd; margin-top: 5px; }
    .map3d-calibrator-panel.map3d-calibrator-minimized .map3d-calibrator-body {
      display: none;
    }
  `;
  document.head.appendChild(style);
  return style;
}

function optionsMarkup(options) {
  return options.map(option => (
    `<option value="${option.value}">${option.label}</option>`
  )).join('');
}

function createPanel() {
  const panel = document.createElement('section');
  panel.className = 'map3d-calibrator-panel';
  panel.innerHTML = `
    <div class="map3d-calibrator-header">
      <strong>Calibrador escala 3D</strong>
      <div>
        <button type="button" data-action="minimize" title="Minimizar">−</button>
        <button type="button" data-action="destroy" title="Cerrar">×</button>
      </div>
    </div>
    <div class="map3d-calibrator-body">
      <div class="map3d-calibrator-row">
        <label for="map3d-calibrator-element">Elemento</label>
        <select id="map3d-calibrator-element" data-field="element">
          ${optionsMarkup(ELEMENT_OPTIONS)}
        </select>
      </div>
      <div class="map3d-calibrator-row">
        <label for="map3d-calibrator-map">Mapa</label>
        <select id="map3d-calibrator-map" data-field="map">
          ${optionsMarkup(MAP_OPTIONS)}
        </select>
      </div>
      <div class="map3d-calibrator-metrics">
        <span>Zoom actual</span><strong data-output="zoom">−</strong>
        <span>Factor productivo</span><strong data-output="product-factor">−</strong>
        <span>Factor temporal</span><strong data-output="temporary-factor">−</strong>
        <span>Punto seleccionado</span><strong data-output="selected-point">−</strong>
      </div>
      <div data-points class="map3d-calibrator-points"></div>
      <div class="map3d-calibrator-row">
        <label for="map3d-calibrator-factor">Factor editable</label>
        <input id="map3d-calibrator-factor" data-field="factor" type="number" min="0.0001" step="0.1">
      </div>
      <div class="map3d-calibrator-actions">
        <button type="button" data-action="adjust" data-step="-0.1">−0.1</button>
        <button type="button" data-action="adjust" data-step="0.1">+0.1</button>
        <button type="button" data-action="apply">Aplicar</button>
        <button type="button" data-action="goto-zoom">Ir al zoom</button>
        <button type="button" data-action="restore-point">Restaurar punto</button>
      </div>
      <div class="map3d-calibrator-actions">
        <button type="button" data-action="add-current">Agregar punto en zoom actual</button>
        <button type="button" data-action="delete-point">Eliminar punto</button>
      </div>
      <div class="map3d-calibrator-actions">
        <button type="button" data-action="restore-combination">Restaurar combinación</button>
        <button type="button" data-action="clear-all">Limpiar todas las calibraciones</button>
      </div>
      <textarea class="map3d-calibrator-output" data-output="configuration" readonly></textarea>
      <div class="map3d-calibrator-actions">
        <button type="button" data-action="copy">Copiar configuración</button>
      </div>
      <div class="map3d-calibrator-status" data-output="status"></div>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function setStatus(state, message) {
  const output = state.panel.querySelector('[data-output="status"]');
  if (output) output.textContent = message;
}

function configurationText(points) {
  const lines = points.map(point => (
    `  Object.freeze({ zoom: ${formatNumber(point.zoom, 1)}, factor: ${formatNumber(point.factor)} })`
  ));

  return [
    'points: Object.freeze([',
    lines.join(',\n'),
    '])'
  ].join('\n');
}

function updatePointList(state) {
  const container = state.panel.querySelector('[data-points]');
  container.innerHTML = state.points.map((point, index) => `
    <button
      type="button"
      data-point-index="${index}"
      aria-pressed="${index === state.selectedIndex}"
    >
      z${formatNumber(point.zoom, 1)} · ${formatNumber(point.factor)}
    </button>
  `).join('');
}

function updateReadouts(state) {
  if (!state.activeEntry) return;

  const selectedMap = getSelectedMap(state);
  const zoom = selectedMap.getZoom();
  const profile = state.activeEntry.profile;
  const productFactor = resolveZoomScaleFactorWithoutOverride(
    zoom,
    profile.points,
    profile.edgePolicy
  );
  const temporaryFactor = resolveZoomScaleFactor(
    zoom,
    profile.points,
    profile.edgePolicy
  );
  const selectedPoint = state.points[state.selectedIndex];

  state.panel.querySelector('[data-output="zoom"]').textContent =
    formatNumber(zoom, 2);
  state.panel.querySelector('[data-output="product-factor"]').textContent =
    formatNumber(productFactor);
  state.panel.querySelector('[data-output="temporary-factor"]').textContent =
    formatNumber(temporaryFactor);
  state.panel.querySelector('[data-output="selected-point"]').textContent =
    selectedPoint ? `z${formatNumber(selectedPoint.zoom, 1)}` : '−';
  state.panel.querySelector('[data-field="factor"]').value =
    selectedPoint ? formatNumber(selectedPoint.factor) : '';
  state.panel.querySelector('[data-output="configuration"]').value =
    configurationText(state.points);
  updatePointList(state);
}

function installActiveOverride(state) {
  setTemporaryZoomScaleOverride(
    state.activeEntry.profile.points,
    state.points
  );
}

function commitActivePoints(state, message) {
  const normalized = normalizePoints(state.points);
  if (!normalized) {
    setStatus(state, 'Configuración inválida.');
    return false;
  }

  state.points = normalized;
  state.selectedIndex = Math.min(
    Math.max(0, state.selectedIndex),
    state.points.length - 1
  );
  installActiveOverride(state);
  const stored = writeStoredCombination(state.activeEntry, state.points);
  getSelectedMap(state).triggerRepaint();
  updateReadouts(state);
  setStatus(state, stored ? message : `${message} No se pudo guardar localmente.`);
  return true;
}

function activateCombination(state, element, map) {
  const nextEntry = findCatalogEntry(element, map);
  if (!nextEntry) return;

  if (state.activeEntry) {
    clearTemporaryZoomScaleOverride(state.activeEntry.profile.points);
  }

  state.activeEntry = nextEntry;
  state.points = loadPointsForEntry(nextEntry);
  state.selectedIndex = 0;
  state.panel.querySelector('[data-field="element"]').value = element;
  state.panel.querySelector('[data-field="map"]').value = map;
  installActiveOverride(state);
  getSelectedMap(state).triggerRepaint();
  updateReadouts(state);
  setStatus(state, `${element} · ${map}`);
}

function selectPoint(state, index) {
  if (!Number.isInteger(index) || !state.points[index]) return;
  state.selectedIndex = index;
  updateReadouts(state);
}

function applySelectedFactor(state) {
  const input = state.panel.querySelector('[data-field="factor"]');
  const factor = normalizeFactor(input.value);
  if (!Number.isFinite(factor) || factor <= 0) {
    setStatus(state, 'El factor debe ser positivo y finito.');
    return;
  }

  state.points[state.selectedIndex] = {
    ...state.points[state.selectedIndex],
    factor
  };
  commitActivePoints(state, 'Factor aplicado.');
}

function adjustFactorInput(state, step) {
  const input = state.panel.querySelector('[data-field="factor"]');
  const currentValue = Number(input.value);
  const nextValue = normalizeFactor(currentValue + step);
  if (Number.isFinite(nextValue) && nextValue > 0) {
    input.value = formatNumber(nextValue);
  }
}

function goToSelectedZoom(state) {
  const point = state.points[state.selectedIndex];
  const map = getSelectedMap(state);
  if (typeof map.easeTo === 'function') {
    map.easeTo({ zoom: point.zoom });
  } else {
    map.jumpTo({ zoom: point.zoom });
  }
}

function restoreSelectedPoint(state) {
  const selectedPoint = state.points[state.selectedIndex];
  const originalPoint = state.activeEntry.profile.points.find(
    point => point.zoom === selectedPoint.zoom
  );

  if (!originalPoint) {
    setStatus(state, 'El punto no existe en el perfil productivo.');
    return;
  }

  state.points[state.selectedIndex] = { ...originalPoint };
  commitActivePoints(state, 'Punto restaurado.');
}

function addPointAtCurrentZoom(state) {
  const map = getSelectedMap(state);
  const zoom = normalizeZoom(map.getZoom());
  const existingIndex = state.points.findIndex(point => point.zoom === zoom);

  if (existingIndex >= 0) {
    selectPoint(state, existingIndex);
    setStatus(state, 'El punto existente fue seleccionado.');
    return;
  }

  const profile = state.activeEntry.profile;
  const factor = resolveZoomScaleFactor(
    zoom,
    profile.points,
    profile.edgePolicy
  );
  state.points.push({ zoom, factor: normalizeFactor(factor) });
  state.points.sort((left, right) => left.zoom - right.zoom);
  state.selectedIndex = state.points.findIndex(point => point.zoom === zoom);
  commitActivePoints(state, 'Punto temporal agregado.');
}

function deleteSelectedPoint(state) {
  if (state.points.length <= 2) {
    setStatus(state, 'Deben permanecer al menos dos puntos.');
    return;
  }

  state.points.splice(state.selectedIndex, 1);
  state.selectedIndex = Math.min(
    state.selectedIndex,
    state.points.length - 1
  );
  commitActivePoints(state, 'Punto temporal eliminado.');
}

function restoreCombination(state) {
  state.points = copyPoints(state.activeEntry.profile.points);
  state.selectedIndex = 0;
  removeStoredCombination(state.activeEntry.key);
  installActiveOverride(state);
  getSelectedMap(state).triggerRepaint();
  updateReadouts(state);
  setStatus(state, 'Combinación restaurada.');
}

function clearAllCalibrations(state) {
  clearStoredCombinations();
  clearTemporaryZoomScaleOverride(state.activeEntry.profile.points);
  state.points = copyPoints(state.activeEntry.profile.points);
  state.selectedIndex = 0;
  installActiveOverride(state);
  getSelectedMap(state).triggerRepaint();
  updateReadouts(state);
  setStatus(state, 'Calibraciones temporales eliminadas.');
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

function handlePanelChange(state, event) {
  if (!event.target.matches('[data-field="element"], [data-field="map"]')) {
    return;
  }

  activateCombination(
    state,
    state.panel.querySelector('[data-field="element"]').value,
    state.panel.querySelector('[data-field="map"]').value
  );
}

function handlePanelClick(state, event) {
  const button = event.target.closest('button');
  if (!button || !state.panel.contains(button)) return;

  if (button.dataset.pointIndex !== undefined) {
    selectPoint(state, Number(button.dataset.pointIndex));
    return;
  }

  switch (button.dataset.action) {
    case 'minimize':
      state.panel.classList.toggle('map3d-calibrator-minimized');
      button.textContent = state.panel.classList.contains('map3d-calibrator-minimized')
        ? '+'
        : '−';
      break;
    case 'destroy':
      destroyMap3DCalibrator();
      break;
    case 'adjust':
      adjustFactorInput(state, Number(button.dataset.step));
      break;
    case 'apply':
      applySelectedFactor(state);
      break;
    case 'goto-zoom':
      goToSelectedZoom(state);
      break;
    case 'restore-point':
      restoreSelectedPoint(state);
      break;
    case 'add-current':
      addPointAtCurrentZoom(state);
      break;
    case 'delete-point':
      deleteSelectedPoint(state);
      break;
    case 'restore-combination':
      restoreCombination(state);
      break;
    case 'clear-all':
      clearAllCalibrations(state);
      break;
    case 'copy': {
      const text = configurationText(state.points);
      copyText(text)
        .then(() => setStatus(state, 'Configuración copiada.'))
        .catch(() => setStatus(state, 'No se pudo copiar la configuración.'));
      break;
    }
    default:
      break;
  }
}

export function initMap3DCalibrator({ mainMap, floatingMap }) {
  if (calibratorState) return calibratorState.panel;
  if (!isUsableMap(mainMap) || !isUsableMap(floatingMap)) {
    throw new TypeError('El calibrador requiere ambos mapas MapLibre activos.');
  }

  const style = createStyle();
  const panel = createPanel();
  const state = {
    mainMap,
    floatingMap,
    style,
    panel,
    activeEntry: null,
    points: [],
    selectedIndex: 0,
    zoomListeners: null,
    handleClick: null,
    handleChange: null
  };

  state.handleClick = event => handlePanelClick(state, event);
  state.handleChange = event => handlePanelChange(state, event);
  state.zoomListeners = {
    main: () => {
      if (state.activeEntry?.map === 'main') updateReadouts(state);
    },
    floating: () => {
      if (state.activeEntry?.map === 'floating') updateReadouts(state);
    }
  };

  panel.addEventListener('click', state.handleClick);
  panel.addEventListener('change', state.handleChange);
  mainMap.on('zoom', state.zoomListeners.main);
  floatingMap.on('zoom', state.zoomListeners.floating);
  calibratorState = state;
  activateCombination(state, 'base', 'main');

  return panel;
}

export function destroyMap3DCalibrator() {
  const state = calibratorState;
  if (!state) return false;

  if (state.activeEntry) {
    clearTemporaryZoomScaleOverride(state.activeEntry.profile.points);
    getSelectedMap(state).triggerRepaint();
  }

  state.mainMap.off('zoom', state.zoomListeners.main);
  state.floatingMap.off('zoom', state.zoomListeners.floating);
  state.panel.removeEventListener('click', state.handleClick);
  state.panel.removeEventListener('change', state.handleChange);
  state.panel.remove();
  state.style.remove();
  calibratorState = null;

  return true;
}
