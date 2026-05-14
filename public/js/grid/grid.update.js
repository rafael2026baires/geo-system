export function hasUnitChanged(prev, next) {

  if (!prev && next) return true;
  if (prev && !next) return true;
  if (!prev && !next) return false;

  return (
    prev.active !== next.active ||
    prev.tech_state !== next.tech_state ||
    prev.state !== next.state ||
    prev.orders_assigned !== next.orders_assigned ||
    prev.orders_loaded !== next.orders_loaded ||
    prev.orders_delivered !== next.orders_delivered ||
    JSON.stringify(prev.clients || []) !== JSON.stringify(next.clients || []) ||
    JSON.stringify(prev.obd || {}) !== JSON.stringify(next.obd || {})
  );

}

export function hasActiveChanged(prev, next) {
  if (!prev && next) return true;
  if (prev && !next) return true;
  if (!prev && !next) return false;

  return prev.active !== next.active;
}

export function getChangedUnitsWithoutActiveChange(prevGetter, units) {
  if (!Array.isArray(units)) return [];

  return units.filter(unit => {
    const prev = prevGetter(unit.unit_id);

    return (
      hasUnitChanged(prev, unit) &&
      !hasActiveChanged(prev, unit)
    );
  });
}