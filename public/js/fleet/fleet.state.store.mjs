// fleet.state.store.mjs
// MEMORIA VIVA DEL FRONTEND
// NO decide l√≥gica
// NO calcula estados
// NO toca UI
// SOLO persiste y expone estado por unidad

export const fleetStateStore = new Map();

/**
 * Lectura directa (sin l®Ægica).
 */
export function getFleetState(unitId) {
  return fleetStateStore.get(unitId) || null;
}

/**
 * Inserta o actualiza el estado observable de una unidad.
 * No infiere nada: guarda exactamente lo que recibe.
 */
export function upsertFleetState({
  unitId,
  state,
  ts,
  lat = null,
  lng = null,
  stoppedSince = undefined
}) {
  const prev = fleetStateStore.get(unitId) || {};

  fleetStateStore.set(unitId, {
    ...prev,
    unitId,
    state,
    ts,
    lat,
    lng,
    stoppedSince:
      stoppedSince !== undefined
        ? stoppedSince
        : prev.stoppedSince ?? null
  });
}


/**
 * Actualiza ®≤nicamente stoppedSince.
 */
export function setStoppedSince(unitId, stoppedSince) {
  const prev = fleetStateStore.get(unitId) || {};
  fleetStateStore.set(unitId, {
    ...prev,
    stoppedSince
  });
}