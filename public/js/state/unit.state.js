export const AppState = {
  activeUnitId: null
};

const focusedUnitListeners = new Set();

function normalizeFocusedUnitId(unitId) {
  if (
    unitId === null ||
    unitId === undefined ||
    typeof unitId === 'boolean' ||
    typeof unitId === 'object' ||
    typeof unitId === 'function' ||
    typeof unitId === 'symbol' ||
    (typeof unitId === 'number' && !Number.isFinite(unitId))
  ) {
    return null;
  }

  const normalizedUnitId = String(unitId).trim();
  return normalizedUnitId || null;
}

function notifyFocusedUnitListeners(focusedUnitId, previousFocusedUnitId) {
  focusedUnitListeners.forEach(listener => {
    try {
      listener(focusedUnitId, previousFocusedUnitId);
    } catch (error) {
      console.error('[UnitState] Error en listener de foco:', error);
    }
  });
}

export function getFocusedUnitId() {
  return AppState.activeUnitId;
}

export function setFocusedUnitId(unitId) {
  const focusedUnitId = normalizeFocusedUnitId(unitId);
  if (focusedUnitId === null || focusedUnitId === AppState.activeUnitId) {
    return AppState.activeUnitId;
  }

  const previousFocusedUnitId = AppState.activeUnitId;
  AppState.activeUnitId = focusedUnitId;
  notifyFocusedUnitListeners(focusedUnitId, previousFocusedUnitId);

  return focusedUnitId;
}

export function clearFocusedUnitId() {
  if (AppState.activeUnitId === null) return;

  const previousFocusedUnitId = AppState.activeUnitId;
  AppState.activeUnitId = null;
  notifyFocusedUnitListeners(null, previousFocusedUnitId);
}

export function subscribeFocusedUnit(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('El listener de foco debe ser una función.');
  }

  focusedUnitListeners.add(listener);

  return () => {
    focusedUnitListeners.delete(listener);
  };
}
