let vehiclesByUnitId = new Map();
let ordersByOrderId = new Map();
let ordersByUnitId = new Map();

function scalarOrNull(value) {
  const type = typeof value;
  return value === null || type === 'string' || type === 'number' || type === 'boolean'
    ? value
    : null;
}

function indexKey(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function copyVehicleContext(unit) {
  return Object.freeze({
    unit_id: scalarOrNull(unit.unit_id),
    vehicle_id: scalarOrNull(unit.vehicle_id),
    vehicle_label: scalarOrNull(unit.vehicle_label),
    vehicle_patent: scalarOrNull(unit.vehicle_patent),
    vehicle_type: scalarOrNull(unit.vehicle_type),
    vehicle_brand: scalarOrNull(unit.vehicle_brand),
    vehicle_model: scalarOrNull(unit.vehicle_model),
    driver_id: scalarOrNull(unit.driver_id),
    driver_name: scalarOrNull(unit.driver_name),
    trip_id: scalarOrNull(unit.trip_id),
    trip_code: scalarOrNull(unit.trip_code),
    trip_started_at: scalarOrNull(unit.trip_started_at)
  });
}

function copyOrderContext(client, unitId) {
  return Object.freeze({
    order_id: scalarOrNull(client.order_id),
    unit_id: scalarOrNull(unitId),
    customer_id: scalarOrNull(client.customer_id),
    company_id: scalarOrNull(client.company_id),
    customer_name: scalarOrNull(client.customer_name),
    address: scalarOrNull(client.address),
    street_address: scalarOrNull(client.street_address),
    city: scalarOrNull(client.city),
    status: scalarOrNull(client.status),
    order_status_label: scalarOrNull(client.order_status_label),
    lat: scalarOrNull(client.lat),
    lng: scalarOrNull(client.lng)
  });
}

export function updateRealtimeContext(json) {
  const nextVehiclesByUnitId = new Map();
  const nextOrdersByOrderId = new Map();
  const nextOrdersByUnitId = new Map();
  const units = Array.isArray(json?.units) ? json.units : [];

  units.forEach(unit => {
    const unitKey = indexKey(unit?.unit_id);
    if (unitKey === null) return;

    nextVehiclesByUnitId.set(unitKey, copyVehicleContext(unit));

    const clients = Array.isArray(unit.clients) ? unit.clients : [];
    clients.forEach(client => {
      const orderKey = indexKey(client?.order_id);
      if (orderKey === null) return;

      const orderContext = copyOrderContext(client, unit.unit_id);
      nextOrdersByOrderId.set(orderKey, orderContext);

      const unitOrders = nextOrdersByUnitId.get(unitKey) || [];
      unitOrders.push(orderContext);
      nextOrdersByUnitId.set(unitKey, unitOrders);
    });
  });

  nextOrdersByUnitId.forEach((orders, unitKey) => {
    nextOrdersByUnitId.set(unitKey, Object.freeze(orders));
  });

  vehiclesByUnitId = nextVehiclesByUnitId;
  ordersByOrderId = nextOrdersByOrderId;
  ordersByUnitId = nextOrdersByUnitId;
}

export function getVehicleContext(unitId) {
  const unitKey = indexKey(unitId);
  const context = unitKey === null ? null : vehiclesByUnitId.get(unitKey);
  return context ? { ...context } : null;
}

export function getOrderContext(orderId) {
  const orderKey = indexKey(orderId);
  const context = orderKey === null ? null : ordersByOrderId.get(orderKey);
  return context ? { ...context } : null;
}

export function getOrdersByUnitId(unitId) {
  const unitKey = indexKey(unitId);
  const contexts = unitKey === null ? null : ordersByUnitId.get(unitKey);
  return contexts ? contexts.map(context => ({ ...context })) : [];
}
