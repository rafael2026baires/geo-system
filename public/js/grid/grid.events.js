import { focusUnit, followUnit, highlightUnitMarker } from '../map/map.camera.control.js';
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

function setActiveUnit(unitId) {
  if (window.AppState) {
    window.AppState.activeUnitId = unitId;
  }

  syncGridSelection();
  highlightUnitMarker(unitId);
}

function handleGridUnitAction(unitId) {
  openFloating(unitId);
}

export function bindGridEvents(container) {
  if (!container || container.dataset.gridEventsBound === '1') return;

  container.dataset.gridEventsBound = '1';

  container.addEventListener('click', (e) => {
    const el = e.target.closest('[data-unit]');
    if (!el || !container.contains(el)) return;

    const unitId = el.dataset.unit;
    if (!unitId) return;

    setActiveUnit(unitId);
    handleGridUnitAction(unitId);

  });
}

document.addEventListener('grid:sync', syncGridSelection);