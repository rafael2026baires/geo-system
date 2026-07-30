const labelStates = new WeakMap();

function normalizeKey(value) {
  if (value === null || value === undefined) return null;

  const key = String(value).trim();
  return key || null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
}

function normalizeCoordinate(value) {
  const text = normalizeText(value);
  if (text === null) return null;

  const coordinate = Number(text);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function createElement(className) {
  const element = document.createElement('span');
  element.className = className;
  return element;
}

function setElementText(element, value) {
  const text = normalizeText(value);
  if (element.dataset.value !== (text || '')) {
    element.dataset.value = text || '';
    element.textContent = text || '';
  }
  element.classList.toggle('floating-focus-info--hidden', text === null);
  return text !== null;
}

function createVehicleRow(label) {
  const row = createElement('floating-focus-vehicle__row');
  const labelElement = createElement('floating-focus-vehicle__row-label');
  const valueElement = createElement('floating-focus-vehicle__row-value');

  labelElement.textContent = label;
  row.append(labelElement, valueElement);

  return { row, valueElement };
}

function createVehicleSection(title, rows) {
  const section = createElement('floating-focus-vehicle__section');
  const titleElement = createElement('floating-focus-vehicle__section-title');
  titleElement.textContent = title;
  section.append(titleElement);

  const rowEntries = {};
  rows.forEach(([key, label]) => {
    const rowEntry = createVehicleRow(label);
    rowEntries[key] = rowEntry;
    section.append(rowEntry.row);
  });

  return { element: section, rows: rowEntries };
}

function createVehicleView(container) {
  container.textContent = '';
  container.classList.add('floating-focus-vehicle');
  container.style.pointerEvents = 'none';

  const header = createElement('floating-focus-vehicle__header');
  const title = createElement('floating-focus-vehicle__title');
  const description = createElement('floating-focus-vehicle__description');
  const unitId = createElement('floating-focus-vehicle__unit');
  header.append(title, description, unitId);

  const driverTrip = createVehicleSection('Conductor y viaje', [
    ['driverName', 'Conductor'],
    ['tripCode', 'Viaje']
  ]);
  const currentState = createVehicleSection('Estado actual', [
    ['signalState', 'Señal'],
    ['activityState', 'Actividad'],
    ['logicalLocation', 'Ubicación'],
    ['lastDataText', 'Último dato']
  ]);
  const orders = createVehicleSection('Pedidos', [
    ['inOperation', 'En operación'],
    ['assigned', 'Asignados'],
    ['loaded', 'Cargados'],
    ['delivered', 'Entregados']
  ]);

  container.append(
    header,
    driverTrip.element,
    currentState.element,
    orders.element
  );

  return {
    title,
    description,
    unitId,
    sections: {
      driverTrip,
      currentState,
      orders
    }
  };
}

function updateVehicleSection(section, values) {
  let hasVisibleRows = false;

  Object.entries(section.rows).forEach(([key, rowEntry]) => {
    const visible = setElementText(rowEntry.valueElement, values?.[key]);
    rowEntry.row.classList.toggle('floating-focus-info--hidden', !visible);
    hasVisibleRows = hasVisibleRows || visible;
  });

  section.element.classList.toggle(
    'floating-focus-info--hidden',
    !hasVisibleRows
  );
}

function createLocationEntry(model) {
  const element = createElement('floating-focus-location');
  element.style.pointerEvents = 'none';

  const title = createElement('floating-focus-location__title');
  const order = createElement('floating-focus-location__order');
  const address = createElement('floating-focus-location__address');
  const city = createElement('floating-focus-location__city');
  element.append(title, order, address, city);

  const marker = new globalThis.maplibregl.Marker({
    element,
    anchor: 'bottom',
    offset: [0, -24]
  });

  return {
    address,
    city,
    element,
    lat: null,
    lng: null,
    marker,
    order,
    title
  };
}

function updateLocationEntry(entry, model, lat, lng) {
  setElementText(entry.title, model.heading);
  setElementText(entry.order, model.orderText);
  setElementText(entry.address, model.addressLine);
  setElementText(entry.city, model.city);

  if (entry.lat !== lat || entry.lng !== lng) {
    entry.lat = lat;
    entry.lng = lng;
    entry.marker.setLngLat([lng, lat]);
  }
}

export function initFloatingFocusInfoLabels(map, { vehicleContainer } = {}) {
  if (!map || !vehicleContainer || labelStates.has(map)) return;

  const state = {
    locations: new Map(),
    map,
    vehicleContainer,
    vehicleView: createVehicleView(vehicleContainer)
  };

  vehicleContainer.classList.add('floating-focus-vehicle--empty');
  labelStates.set(map, state);
}

export function updateFloatingFocusedVehicle(map, vehicleDetailModel) {
  const state = labelStates.get(map);
  if (!state || !vehicleDetailModel) return;

  const view = state.vehicleView;
  const identification = vehicleDetailModel.identification ?? {};
  const description = [
    identification.vehicleType,
    identification.vehicleBrand,
    identification.vehicleModel
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' · ');

  setElementText(view.title, identification.primaryText);
  setElementText(view.description, description);
  setElementText(
    view.unitId,
    identification.unitId ? `Unidad: ${identification.unitId}` : null
  );
  updateVehicleSection(view.sections.driverTrip, vehicleDetailModel.driverTrip);
  updateVehicleSection(view.sections.currentState, vehicleDetailModel.currentState);
  updateVehicleSection(view.sections.orders, vehicleDetailModel.orders);

  state.vehicleContainer.classList.remove('floating-focus-vehicle--empty');
}

export function setFloatingRelatedLocationLabels(map, orderDetailModels) {
  const state = labelStates.get(map);
  if (!state) return;

  const nextKeys = new Set();
  const models = Array.isArray(orderDetailModels) ? orderDetailModels : [];

  models.forEach(model => {
    const key = normalizeKey(model?.orderId);
    const lat = normalizeCoordinate(model?.lat);
    const lng = normalizeCoordinate(model?.lng);
    if (!key || lat === null || lng === null || nextKeys.has(key)) return;

    nextKeys.add(key);
    let entry = state.locations.get(key);

    if (!entry) {
      entry = createLocationEntry(model);
      state.locations.set(key, entry);
      entry.marker.setLngLat([lng, lat]).addTo(map);
      entry.lat = lat;
      entry.lng = lng;
    }

    updateLocationEntry(entry, model, lat, lng);
  });

  state.locations.forEach((entry, key) => {
    if (nextKeys.has(key)) return;

    entry.marker.remove();
    state.locations.delete(key);
  });
}

export function clearFloatingFocusInfoLabels(map) {
  const state = labelStates.get(map);
  if (!state) return;

  state.vehicleContainer.classList.add('floating-focus-vehicle--empty');
  state.locations.forEach(entry => {
    entry.marker.remove();
  });
  state.locations.clear();
}

export function destroyFloatingFocusInfoLabels(map) {
  const state = labelStates.get(map);
  if (!state) return;

  clearFloatingFocusInfoLabels(map);
  state.vehicleContainer.textContent = '';
  state.vehicleContainer.classList.remove(
    'floating-focus-vehicle',
    'floating-focus-vehicle--empty'
  );
  labelStates.delete(map);
}
