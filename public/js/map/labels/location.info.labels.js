import { buildFocusedLocationCompactModel } from './focus.info.formatters.js';

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

function normalizeCoordinate(value) {
  if (value === null || value === undefined || normalizeText(value) === '') {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function buildLabelText(orderId, customerName) {
  return normalizeText(customerName) || `Pedido #${orderId}` || orderId;
}

function applyEntryVisibility(state, entry) {
  entry.element.classList.toggle(
    'location-info-label--hidden',
    !state.visible
  );
}

function updateAllVisibility(state) {
  state.labels.forEach(entry => {
    applyEntryVisibility(state, entry);
  });
}

function createLabelElement(text) {
  const element = document.createElement('div');
  element.className = 'location-info-label';
  element.style.pointerEvents = 'none';

  const textElement = document.createElement('div');
  textElement.className = 'location-info-label__text';

  const primaryElement = document.createElement('div');
  primaryElement.className = 'location-info-label__primary';
  primaryElement.textContent = text;

  const secondaryElement = document.createElement('div');
  secondaryElement.className = 'location-info-label__secondary';

  textElement.append(primaryElement, secondaryElement);
  element.append(textElement);

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
    entry.element.classList.toggle('location-info-label--focused', focused);
  }
}

function restoreNormalContent(entry) {
  applyFocusedContent(entry, {
    primaryText: entry.text,
    secondaryText: null
  });
}

export function initLocationInfoLabels(map, options = {}) {
  if (!map || labelStates.has(map)) return;

  void options;

  const state = {
    map,
    labels: new Map(),
    focusedKeys: new Set(),
    visible: true
  };

  labelStates.set(map, state);
}

export function setLocationInfoLabels(map, locations) {
  if (!map) return;

  if (!labelStates.has(map)) {
    initLocationInfoLabels(map);
  }

  const state = labelStates.get(map);
  const nextKeys = new Set();
  const items = Array.isArray(locations) ? locations : [];

  items.forEach(location => {
    const key = normalizeKey(location?.order_id);
    const lat = normalizeCoordinate(location?.lat);
    const lng = normalizeCoordinate(location?.lng);

    if (
      !key ||
      lat === null ||
      lng === null ||
      nextKeys.has(key)
    ) {
      return;
    }

    nextKeys.add(key);

    const text = buildLabelText(key, location?.customer_name);
    const unitId = normalizeKey(location?.unit_id);
    let entry = state.labels.get(key);

    if (!entry) {
      const { element, primaryElement, secondaryElement } = createLabelElement(text);
      const marker = new globalThis.maplibregl.Marker({
        element,
        anchor: 'bottom'
      });

      entry = {
        element,
        focused: false,
        lat,
        lng,
        marker,
        primaryElement,
        primaryText: text,
        secondaryElement,
        secondaryText: null,
        text,
        unitId
      };
      state.labels.set(key, entry);
      marker.setLngLat([lng, lat]).addTo(map);
    } else {
      if (entry.text !== text) {
        entry.text = text;
        if (!entry.focused) {
          entry.primaryText = text;
          entry.primaryElement.textContent = text;
        }
      }

      entry.unitId = unitId;

      if (entry.lat !== lat || entry.lng !== lng) {
        entry.lat = lat;
        entry.lng = lng;
        entry.marker.setLngLat([lng, lat]);
      }
    }

    applyEntryVisibility(state, entry);
  });

  state.labels.forEach((entry, key) => {
    if (nextKeys.has(key)) return;

    entry.marker.remove();
    state.labels.delete(key);
    state.focusedKeys.delete(key);
  });
}

export function setLocationInfoLabelsVisible(map, visible) {
  const state = labelStates.get(map);
  if (!state) return;

  state.visible = Boolean(visible);
  updateAllVisibility(state);
}

export function setFocusedLocationInfoLabels(map, unitId, orderContexts) {
  const state = labelStates.get(map);
  if (!state) return;

  const focusedUnitKey = normalizeKey(unitId);
  const ordersByKey = new Map();
  const orders = Array.isArray(orderContexts) ? orderContexts : [];
  orders.forEach(order => {
    const orderKey = normalizeKey(order?.order_id);
    if (orderKey && !ordersByKey.has(orderKey)) {
      ordersByKey.set(orderKey, order);
    }
  });

  const nextFocusedKeys = new Set();

  state.labels.forEach((entry, key) => {
    if (entry.unitId !== focusedUnitKey) return;

    const order = ordersByKey.get(key);
    if (!order) return;

    const model = buildFocusedLocationCompactModel(order);
    applyFocusedContent(entry, model);
    if (entry.focused) nextFocusedKeys.add(key);
  });

  state.focusedKeys.forEach(key => {
    if (nextFocusedKeys.has(key)) return;

    const entry = state.labels.get(key);
    if (entry) restoreNormalContent(entry);
  });

  state.focusedKeys = nextFocusedKeys;
}

export function clearFocusedLocationInfoLabels(map) {
  const state = labelStates.get(map);
  if (!state) return;

  state.focusedKeys.forEach(key => {
    const entry = state.labels.get(key);
    if (entry) restoreNormalContent(entry);
  });
  state.focusedKeys.clear();
}

export function clearLocationInfoLabels(map) {
  const state = labelStates.get(map);
  if (!state) return;

  state.labels.forEach(entry => {
    entry.marker.remove();
  });
  state.labels.clear();
  state.focusedKeys.clear();
}

export function destroyLocationInfoLabels(map) {
  const state = labelStates.get(map);
  if (!state) return;

  clearLocationInfoLabels(map);
  labelStates.delete(map);
}
