import {
  setMarkerIcon,
  getMarkerElement,
  createDivIcon,
  createMapMarker
} from '../map.adapter.js';

function resolveVehicleMarkerVisualByZoom(zoom) {
  if (zoom < 13) return { type: 'dot', size: 5 };
  if (zoom < 15) return { type: 'truck', size: 12 };
  if (zoom < 16) return { type: 'truck', size: 14 };
  if (zoom < 18) return { type: 'truck', size: 20 };
  return { type: 'truck', size: 25 };
}

function createVehicleDomIcon(type, size) {
  if (type === 'dot') {
    return createDivIcon({
      className: 'veh-dot-icon',
      html: `<div class="veh-dot"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  return createDivIcon({
    className: 'veh-icon',
    html: `
      <div class="veh-wrapper">
        <img class="veh-img" src="/assets/images/truck1.png">
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

export function createVehicleDomMarker(layer, p, zoom = 13, options = {}) {
  const visual = resolveVehicleMarkerVisualByZoom(zoom);
  const icon = createVehicleDomIcon(visual.type, visual.size);

  const marker = createMapMarker(layer, p, {
    icon,
    interactive: options.interactive ?? true
  });

  marker.__vehicleVisual = visual;

  return marker;
}

export function updateVehicleMarkerVisualByZoom(marker, zoom) {
  if (!marker) return;

  const visual = resolveVehicleMarkerVisualByZoom(zoom);
  const prev = marker.__vehicleVisual;

  if (
    prev &&
    prev.type === visual.type &&
    prev.size === visual.size
  ) return;

  setMarkerIcon(marker, createVehicleDomIcon(visual.type, visual.size));
  marker.__vehicleVisual = visual;

  if (marker.__vehicleHighlighted) {
    const el = getMarkerElement(marker);
    if (el) el.classList.add('veh-marker-highlight');
  }
}

export function setVehicleMarkerBearing(marker, deg) {
  if (!marker) return;

  const el = getMarkerElement(marker);
  if (!el) return;

  el.style.setProperty('--bearing', `${deg}deg`);
}

export function setVehicleMarkerHighlighted(marker, highlighted) {
  if (!marker) return;

  marker.__vehicleHighlighted = highlighted;

  const el = getMarkerElement(marker);
  if (!el) return;

  if (highlighted) {
    el.classList.add('veh-marker-highlight');
  } else {
    el.classList.remove('veh-marker-highlight');
  }
}