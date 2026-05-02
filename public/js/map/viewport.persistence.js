const KEY = 'viewport_state_v1';

export function saveViewportState({ map, viewportMode }) {
  const center = map.getCenter();
  const zoom = map.getZoom();

  const data = {
    center: [center.lat, center.lng],
    zoom,
    viewportMode
  };

  localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadViewportState() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}