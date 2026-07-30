import {
  setVehicleInfoLabelsVisible
} from './labels/vehicle.info.labels.js';
import {
  setLocationInfoLabelsVisible
} from './labels/location.info.labels.js';

const VEHICLE_LABELS_STORAGE_KEY =
  'geo_main_map_vehicle_labels_visible';
const LOCATION_LABELS_STORAGE_KEY =
  'geo_main_map_location_labels_visible';

const uiStates = new WeakMap();

function readPreference(storageKey) {
  const storedValue = localStorage.getItem(storageKey);
  return storedValue === null ? true : storedValue === 'true';
}

function writePreference(storageKey, visible) {
  localStorage.setItem(storageKey, String(Boolean(visible)));
}

function applyPreferences(map, state) {
  const vehicleVisible = readPreference(VEHICLE_LABELS_STORAGE_KEY);
  const locationVisible = readPreference(LOCATION_LABELS_STORAGE_KEY);

  state.vehicleInput.checked = vehicleVisible;
  state.locationInput.checked = locationVisible;
  setVehicleInfoLabelsVisible(map, vehicleVisible);
  setLocationInfoLabelsVisible(map, locationVisible);
}

export function initMapLabelsUI(map) {
  if (!map || typeof map.getContainer !== 'function') return null;

  const existingState = uiStates.get(map);
  if (existingState) {
    applyPreferences(map, existingState);
    return existingState.container;
  }

  const container = document.createElement('div');
  container.className = 'map-labels-control';
  container.innerHTML = `
    <div class="map-labels-control__title">Etiquetas</div>
    <label class="map-labels-control__option">
      <span class="map-labels-control__label">Vehículos</span>
      <input type="checkbox" data-label-kind="vehicle">
      <span class="map-labels-control__toggle" aria-hidden="true"></span>
    </label>
    <label class="map-labels-control__option">
      <span class="map-labels-control__label">Destinos</span>
      <input type="checkbox" data-label-kind="location">
      <span class="map-labels-control__toggle" aria-hidden="true"></span>
    </label>
  `;

  const vehicleInput = container.querySelector(
    'input[data-label-kind="vehicle"]'
  );
  const locationInput = container.querySelector(
    'input[data-label-kind="location"]'
  );
  const state = {
    container,
    locationInput,
    vehicleInput
  };

  container.addEventListener('change', event => {
    const input = event.target.closest('input[data-label-kind]');
    if (!input || !container.contains(input)) return;

    if (input.dataset.labelKind === 'vehicle') {
      writePreference(VEHICLE_LABELS_STORAGE_KEY, input.checked);
      setVehicleInfoLabelsVisible(map, input.checked);
    }

    if (input.dataset.labelKind === 'location') {
      writePreference(LOCATION_LABELS_STORAGE_KEY, input.checked);
      setLocationInfoLabelsVisible(map, input.checked);
    }
  });

  uiStates.set(map, state);
  map.getContainer().appendChild(container);
  applyPreferences(map, state);

  return container;
}
