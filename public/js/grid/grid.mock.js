export const USE_GRID_MOCK = false;
export const USE_OBD_MOCK = false;

export const mockObdByVehicleId = {
  2: {
    fuel_level: 79,
    engine_on: true,
    engine_temp: 89,
    battery_voltage: 14,
    odometer: 154233
  }
};

export const mockBase = {
  lat: -38.0101,
  lng: -57.5443
};

export const mockUnits = [
  {
    unit_id: 'U-RSFB6P',
    vehicle_id: 2,
    active: 1,
    tech_state: 'MOVING',
    state: 'client',
    orders_assigned: 2,
    orders_loaded: 5,
    orders_delivered: 3,
    clients: [
      { lat: -38.0069, lng: -57.5417, status: 40 },
      { lat: -38.0007, lng: -57.5414, status: 40 },
      { lat: -37.9897, lng: -57.5502, status: 20 }
    ],
    obd: {
      fuel_level: 79,
      engine_on: true,
      engine_temp: 89,
      battery_voltage: 14,
      odometer: 154233
    }
  },
  {
    unit_id: 'U-DEMO2',
    vehicle_id: 3,
    active: 1,
    tech_state: 'STOPPED',
    state: 'base',
    orders_assigned: 4,
    orders_loaded: 0,
    orders_delivered: 0,
    clients: [
      { lat: -38.011, lng: -57.54, status: 20 },
      { lat: -38.012, lng: -57.55, status: 20 }
    ],
    obd: {
      fuel_level: 42,
      engine_on: false,
      engine_temp: 74,
      battery_voltage: 12.4,
      odometer: 88120
    }
  }
];