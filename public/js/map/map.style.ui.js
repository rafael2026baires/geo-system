import { MAP_STYLES, ACTIVE_MAP_STYLE } from './map.styles.js';

export function initMapStyleUI(map) {
  if (!map) return;

  const mapEl = map.getContainer();
  if (!mapEl) return;

  const container = document.createElement('div');
  container.className = 'map-style-selector';

  container.innerHTML = `
    <select title="Estilo de mapa">
      ${MAP_STYLES.map(style => `
        <option value="${style.id}" ${style.id === ACTIVE_MAP_STYLE.id ? 'selected' : ''}>
          ${style.label}
        </option>
      `).join('')}
    </select>
  `;

  const select = container.querySelector('select');

  select.addEventListener('change', () => {
    localStorage.setItem('geo_map_style_id', select.value);
    window.location.reload();
  });

  mapEl.appendChild(container);
}