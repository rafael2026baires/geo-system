function normalizeText(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
}

function normalizeCount(value) {
  if (value === null || value === undefined || value === '') return null;

  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function formatVisualDate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const mysqlMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/
  );

  if (mysqlMatch) {
    const [, year, month, day, hours, minutes] = mysqlMatch;
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
}

function resolveVehicleIdentifier(context) {
  return (
    normalizeText(context?.vehicle_patent) ||
    normalizeText(context?.vehicle_label) ||
    normalizeText(context?.vehicle_id) ||
    normalizeText(context?.unit_id) ||
    ''
  );
}

function resolveLogicalLocation(rawUnit) {
  const state = normalizeText(rawUnit?.state)?.toLowerCase();

  if (state === 'base') return 'Base';
  if (state === 'street') return 'Calle';
  if (state === 'client') return 'Cliente';
  if (rawUnit?.in_base === true || rawUnit?.in_base === 1) return 'Base';
  if (rawUnit?.in_street === true || rawUnit?.in_street === 1) return 'Calle';
  if (rawUnit?.in_client === true || rawUnit?.in_client === 1) return 'Cliente';

  return null;
}

export function formatVehicleMinimal(context) {
  const identifier = resolveVehicleIdentifier(context);
  const vehicleType = normalizeText(context?.vehicle_type);

  return vehicleType && identifier
    ? `${identifier} · ${vehicleType}`
    : identifier || vehicleType || '';
}

export function buildFocusedVehicleCompactModel(context) {
  const secondaryParts = [];
  const driverName = normalizeText(context?.driver_name);
  const tripCode = normalizeText(context?.trip_code);

  if (driverName) secondaryParts.push(`Chofer: ${driverName}`);
  if (tripCode) secondaryParts.push(`Viaje: ${tripCode}`);

  return {
    primaryText: formatVehicleMinimal(context),
    secondaryText: secondaryParts.length > 0
      ? secondaryParts.join(' · ')
      : null
  };
}

export function formatLocationMinimal(order) {
  const customerName = normalizeText(order?.customer_name);
  const orderId = normalizeText(order?.order_id);

  return customerName || (orderId ? `Pedido #${orderId}` : '');
}

export function buildFocusedLocationCompactModel(order) {
  const orderId = normalizeText(order?.order_id);
  const statusLabel = normalizeText(order?.order_status_label);
  const secondaryParts = [];

  if (orderId) secondaryParts.push(`Pedido #${orderId}`);
  if (orderId && statusLabel) secondaryParts.push(statusLabel);

  return {
    primaryText: formatLocationMinimal(order),
    secondaryText: secondaryParts.length > 0
      ? secondaryParts.join(' · ')
      : null
  };
}

export function buildFloatingVehicleDetailModel(vehicleContext, rawUnit) {
  const context = vehicleContext ?? {};
  const unit = rawUnit ?? {};
  const driverName = normalizeText(context.driver_name);
  const tripCode = normalizeText(context.trip_code);
  const serverTimestamp = Number(unit.server_ts);

  return {
    identification: {
      primaryText: resolveVehicleIdentifier(context),
      vehicleType: normalizeText(context.vehicle_type),
      vehicleBrand: normalizeText(context.vehicle_brand),
      vehicleModel: normalizeText(context.vehicle_model),
      unitId: normalizeText(context.unit_id ?? unit.unit_id)
    },
    driverTrip: {
      driverName: driverName || 'Sin asignar',
      tripCode: tripCode || 'Sin viaje activo'
    },
    currentState: {
      logicalLocation: resolveLogicalLocation(unit),
      signalState: normalizeText(unit.signal_state),
      activityState: normalizeText(unit.activity_state),
      lastDataText: Number.isFinite(serverTimestamp) && serverTimestamp > 0
        ? formatVisualDate(new Date(serverTimestamp * 1000).toISOString())
        : null
    },
    orders: {
      inOperation: normalizeCount(unit.orders_in_operation),
      assigned: normalizeCount(unit.orders_assigned),
      loaded: normalizeCount(unit.orders_loaded),
      delivered: normalizeCount(unit.orders_delivered)
    }
  };
}

export function buildFloatingOrderDetailModel(orderContext) {
  const order = orderContext ?? {};
  const customerName = normalizeText(order.customer_name);
  const orderId = normalizeText(order.order_id);
  const statusLabel = normalizeText(order.order_status_label);
  const streetAddress = normalizeText(order.street_address);
  const address = normalizeText(order.address);
  const addressLine = streetAddress || address;
  const orderParts = [];

  if (orderId) orderParts.push(`#${orderId}`);
  if (orderId && statusLabel) orderParts.push(statusLabel);

  return {
    customerName,
    orderId,
    orderStatusLabel: statusLabel,
    heading: customerName || (orderId ? `Pedido #${orderId}` : ''),
    orderText: orderParts.length > 0 ? orderParts.join(' · ') : null,
    addressLine,
    city: normalizeText(order.city)
  };
}
