const lastUnitsById = new Map();

export function getLastUnit(unitId) {
  return lastUnitsById.get(unitId) || null;
}

export function setLastUnit(unit) {
  if (!unit || !unit.unit_id) return;
  lastUnitsById.set(unit.unit_id, structuredClone(unit));
}

export function setLastUnits(units) {
  if (!Array.isArray(units)) return;

  units.forEach(unit => {
    setLastUnit(unit);
  });
}

export function clearGridStore() {
  lastUnitsById.clear();
}