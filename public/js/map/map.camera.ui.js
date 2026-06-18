import {
  getMapBearing,
  getMapPitch,
  setMapBearing,
  setMapPitch,
  resetMapCamera
} from './map.adapter.js';

export function initMapCameraUI(map) {
  if (!map) return;

  const container = document.createElement('div');
  container.className = 'map-camera-controls';

  container.innerHTML = `
    <button type="button" data-camera="pitch-up" title="Más apaisado">↘</button>
    <button type="button" data-camera="pitch-down" title="Vista superior">↗</button>
    <button type="button" data-camera="rotate-left" title="Rotar izquierda">⟲</button>
    <button type="button" data-camera="rotate-right" title="Rotar derecha">⟳</button>
    <button type="button" data-camera="reset" title="Vista comercial">◎</button>
  `;

  const mapEl = map.getContainer();
  mapEl.appendChild(container);

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.camera;

    if (action === 'pitch-up') {
      setMapPitch(map, Math.min(75, getMapPitch(map) + 10));
    }

    if (action === 'pitch-down') {
      setMapPitch(map, Math.max(0, getMapPitch(map) - 10));
    }

    if (action === 'rotate-left') {
      setMapBearing(map, getMapBearing(map) - 20);
    }

    if (action === 'rotate-right') {
      setMapBearing(map, getMapBearing(map) + 20);
    }

    if (action === 'reset') {
      resetMapCamera(map);
    }
  });
}