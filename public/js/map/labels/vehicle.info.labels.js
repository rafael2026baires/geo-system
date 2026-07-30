import { buildFocusedVehicleCompactModel } from './focus.info.formatters.js';

const VEHICLE_INFO_LABEL_SCREEN_GAP_PX = 4;

const labelStates = new WeakMap();

function normalizeKey(value) {
  if (value === null || value === undefined) return null;

  const key = String(value).trim();
  return key || null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildLabelText(unitId, data) {
  const identifier =
    normalizeText(data?.vehicle_patent) ||
    normalizeText(data?.vehicle_label) ||
    normalizeText(data?.vehicle_id) ||
    normalizeText(unitId);
  const vehicleType = normalizeText(data?.vehicle_type);

  return vehicleType ? `${identifier} · ${vehicleType}` : identifier;
}

function applyEntryVisibility(state, entry) {
  entry.element.classList.toggle(
    'vehicle-info-label--hidden',
    !state.visible || !entry.operationalVisible || !entry.hasScreenBounds
  );
}

function updateAllVisibility(state) {
  state.labels.forEach(entry => {
    applyEntryVisibility(state, entry);
  });
}

function createLabelElement(text) {
  const element = document.createElement('div');
  element.className = 'vehicle-info-label';
  element.style.pointerEvents = 'none';

  const textElement = document.createElement('div');
  textElement.className = 'vehicle-info-label__text';

  const primaryElement = document.createElement('div');
  primaryElement.className = 'vehicle-info-label__primary';
  primaryElement.textContent = text;

  const secondaryElement = document.createElement('div');
  secondaryElement.className = 'vehicle-info-label__secondary';

  textElement.append(primaryElement, secondaryElement);

  const guideElement = document.createElement('div');
  guideElement.className = 'vehicle-info-label__guide';

  element.append(textElement, guideElement);

  return { element, primaryElement, secondaryElement };
}

function applyFocusedContent(entry, model) {
  const secondaryText = model?.secondaryText || null;
  const focused = secondaryText !== null;

  if (entry.primaryText !== model.primaryText) {
    entry.primaryText = model.primaryText;
    entry.primaryElement.textContent = model.primaryText;
  }
  if (entry.secondaryText !== secondaryText) {
    entry.secondaryText = secondaryText;
    entry.secondaryElement.textContent = secondaryText || '';
  }
  if (entry.focused !== focused) {
    entry.focused = focused;
    entry.element.classList.toggle('vehicle-info-label--focused', focused);
  }
}

function restoreNormalContent(entry) {
  applyFocusedContent(entry, {
    primaryText: entry.text,
    secondaryText: null
  });
}

export function initVehicleInfoLabels(map, options = {}) {
  if (!map || labelStates.has(map)) return;

  void options;

  const overlay = document.createElement('div');
  overlay.className = 'vehicle-info-label-overlay';
  overlay.style.pointerEvents = 'none';
  map.getContainer().append(overlay);

  const state = {
    map,
    labels: new Map(),
    overlay,
    boundsVersion: 0,
    focusedKey: null,
    visible: true
  };

  labelStates.set(map, state);
}

export function upsertVehicleInfoLabel(map, unitId, data = {}) {
  const key = normalizeKey(unitId);
  if (!map || !key) return null;

  if (!labelStates.has(map)) {
    initVehicleInfoLabels(map);
  }

  const state = labelStates.get(map);
  let entry = state.labels.get(key);
  const text = buildLabelText(key, data);

  if (!entry) {
    const { element, primaryElement, secondaryElement } = createLabelElement(text);

    entry = {
      element,
      boundsVersion: 0,
      hasScreenBounds: false,
      lastTransform: '',
      operationalVisible: Boolean(data.visible),
      focused: false,
      primaryElement,
      primaryText: text,
      secondaryElement,
      secondaryText: null,
      text,
    };

    state.labels.set(key, entry);
    state.overlay.append(element);
  } else {
    entry.operationalVisible = Boolean(data.visible);

    if (entry.text !== text) {
      entry.text = text;
      if (!entry.focused) {
        entry.primaryText = text;
        entry.primaryElement.textContent = text;
      }
    }
  }

  applyEntryVisibility(state, entry);
  return entry.element;
}

export function updateVehicleInfoLabelScreenBounds(map, boundsByUnitId) {
  const state = labelStates.get(map);
  if (!state) return;

  const boundsVersion = ++state.boundsVersion;

  if (boundsByUnitId instanceof Map) {
    boundsByUnitId.forEach((bounds, unitId) => {
      const key = normalizeKey(unitId);
      const entry = key ? state.labels.get(key) : null;
      const left = Number(bounds?.left);
      const right = Number(bounds?.right);
      const top = Number(bounds?.top);

      if (
        !entry ||
        !Number.isFinite(left) ||
        !Number.isFinite(right) ||
        !Number.isFinite(top)
      ) {
        return;
      }

      const anchorX = (left + right) / 2;
      const anchorY = top - VEHICLE_INFO_LABEL_SCREEN_GAP_PX;
      const transform =
        `translate3d(${anchorX}px, ${anchorY}px, 0) ` +
        'translate(-50%, -100%)';

      if (entry.lastTransform !== transform) {
        entry.lastTransform = transform;
        entry.element.style.transform = transform;
      }

      entry.boundsVersion = boundsVersion;
      entry.hasScreenBounds = true;
      applyEntryVisibility(state, entry);
    });
  }

  state.labels.forEach(entry => {
    if (entry.boundsVersion === boundsVersion) return;

    entry.hasScreenBounds = false;
    applyEntryVisibility(state, entry);
  });
}

export function setVehicleInfoLabelVisible(map, unitId, visible) {
  const key = normalizeKey(unitId);
  const state = labelStates.get(map);
  const entry = key ? state?.labels.get(key) : null;

  if (!state || !entry) return;

  entry.operationalVisible = Boolean(visible);
  applyEntryVisibility(state, entry);
}

export function setVehicleInfoLabelsVisible(map, visible) {
  const state = labelStates.get(map);
  if (!state) return;

  state.visible = Boolean(visible);
  updateAllVisibility(state);
}

export function setFocusedVehicleInfoLabel(map, unitId, vehicleContext) {
  const key = normalizeKey(unitId);
  const state = labelStates.get(map);
  if (!state) return;

  if (state.focusedKey && state.focusedKey !== key) {
    const previousEntry = state.labels.get(state.focusedKey);
    if (previousEntry) restoreNormalContent(previousEntry);
  }

  state.focusedKey = key;
  const entry = key ? state.labels.get(key) : null;
  if (!entry) return;

  if (!vehicleContext) {
    restoreNormalContent(entry);
    return;
  }

  applyFocusedContent(
    entry,
    buildFocusedVehicleCompactModel(vehicleContext)
  );
}

export function clearFocusedVehicleInfoLabel(map) {
  const state = labelStates.get(map);
  if (!state) return;

  if (state.focusedKey) {
    const entry = state.labels.get(state.focusedKey);
    if (entry) restoreNormalContent(entry);
  }

  state.focusedKey = null;
}

export function removeVehicleInfoLabel(map, unitId) {
  const key = normalizeKey(unitId);
  const state = labelStates.get(map);
  const entry = key ? state?.labels.get(key) : null;

  if (!state || !entry) return;

  entry.element.remove();
  state.labels.delete(key);
  if (state.focusedKey === key) {
    state.focusedKey = null;
  }
}

export function destroyVehicleInfoLabels(map) {
  const state = labelStates.get(map);
  if (!state) return;

  state.labels.forEach(entry => {
    entry.element.remove();
  });
  state.labels.clear();
  state.overlay.remove();
  labelStates.delete(map);
}
