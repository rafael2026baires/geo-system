import { focusUnit, followUnit } from '../map/map.camera.control.js';
import { openFloating, closeFloating } from '../map/map.floating.js';

export function syncGridSelection() {
  const activeId = window.AppState?.activeUnitId;

  document.querySelectorAll('[data-unit]').forEach(el => {
    if (el.dataset.unit === activeId) {
      el.classList.add('grid-active');
    } else {
      el.classList.remove('grid-active');
    }
  });
}

export function bindGridEvents(container) {
  if (!container || container.dataset.gridEventsBound === '1') return;

  container.dataset.gridEventsBound = '1';

  container.addEventListener('click', (e) => {
    const el = e.target.closest('[data-unit]');
    if (!el || !container.contains(el)) return;

    const unitId = el.dataset.unit;
    if (!unitId) return;

    if (window.AppState) {
      window.AppState.activeUnitId = unitId;
    }

    syncGridSelection();

    if (window.AppState?.mode === 'MAP') {
      focusUnit(unitId);
      followUnit(unitId);
      closeFloating();
    }

    if (window.AppState?.mode === 'FLOATING') {
      openFloating(unitId);
    }
  });
}

document.addEventListener('grid:sync', syncGridSelection);