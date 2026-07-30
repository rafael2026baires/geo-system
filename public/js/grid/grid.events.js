import { focusUnit, followUnit, highlightUnitMarker } from '../map/map.camera.control.js';
import { openFloating, closeFloating } from '../map/map.floating.js';
import { getFocusedUnitId, setFocusedUnitId } from '../state/unit.state.js';

export function syncGridSelection() {
  const activeId = getFocusedUnitId();

  document.querySelectorAll('[data-row-unit]').forEach(firstCell => {
    const isActive = firstCell.dataset.rowUnit === activeId;
    let cell = firstCell;

    while (cell) {
      if (cell.classList.contains('item')) {
        cell.classList.toggle('grid-active', isActive);
      }

      cell = cell.nextElementSibling;
      if (cell?.hasAttribute('data-row-unit')) break;
    }
  });
}

function setActiveUnit(unitId) {
  setFocusedUnitId(unitId);

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
