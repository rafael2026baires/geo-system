
/* *****************************  LOCATIONS  *************************** */
export const MAIN_MAP_LOCATION_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 13 }),
    Object.freeze({ zoom: 13, factor: 7 }),
    Object.freeze({ zoom: 14, factor: 4 }),
    Object.freeze({ zoom: 15, factor: 2.5 }),
    Object.freeze({ zoom: 16, factor: 1.6 }),
    Object.freeze({ zoom: 17, factor: 1 }),
    Object.freeze({ zoom: 18, factor: 0.8 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'exponential',
    fallbackFactor: 1
  })
});

export const FLOATING_MAP_LOCATION_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 13 }),
    Object.freeze({ zoom: 13, factor: 7 }),
    Object.freeze({ zoom: 14, factor: 4 }),
    Object.freeze({ zoom: 15, factor: 2.5 }),
    Object.freeze({ zoom: 16, factor: 1.6 }),
    Object.freeze({ zoom: 17, factor: 1 }),
    Object.freeze({ zoom: 18, factor: 0.8 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'exponential',
    fallbackFactor: 1
  })
});
/* ************************************************************************ */

/* *******************************  VEHÍCULOS  **************************** */
export const MAIN_MAP_VEHICLE_SCALE_PROFILE = Object.freeze({  // MAPA PRINCIPAL
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 28 }),
    Object.freeze({ zoom: 13, factor: 14.5 }),
    Object.freeze({ zoom: 14, factor: 8.4 }),
    Object.freeze({ zoom: 15, factor: 4.6 }),
    Object.freeze({ zoom: 16, factor: 3.2 }),
    Object.freeze({ zoom: 17, factor: 2.5 }),
    Object.freeze({ zoom: 18, factor: 1.5 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'exponential',
    fallbackFactor: 1
  })
});

export const FLOATING_MAP_VEHICLE_SCALE_PROFILE = Object.freeze({  // MAPA SECUNDARIO
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 28 }),
    Object.freeze({ zoom: 13, factor: 14.5 }),
    Object.freeze({ zoom: 14, factor: 9 }),
    Object.freeze({ zoom: 15, factor: 5 }),
    Object.freeze({ zoom: 16, factor: 3.5 }),
    Object.freeze({ zoom: 17, factor: 2.5 }),
    Object.freeze({ zoom: 18, factor: 1.5 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'exponential',
    fallbackFactor: 1
  })
});
/* *************************************************************************** */

/* *********************************  BASE  ********************************** */
export const MAIN_MAP_LOGISTICS_BASE_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 9 }),
    Object.freeze({ zoom: 13, factor: 5 }),
    Object.freeze({ zoom: 14, factor: 2.7 }),
    Object.freeze({ zoom: 15, factor: 2 }),
    Object.freeze({ zoom: 16, factor: 1.5 }),
    Object.freeze({ zoom: 17, factor: 1.2 }),
    Object.freeze({ zoom: 18, factor: 1 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'clamp',
    fallbackFactor: 1
  })
});

export const FLOATING_MAP_LOGISTICS_BASE_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 9 }),
    Object.freeze({ zoom: 13, factor: 5 }),
    Object.freeze({ zoom: 14, factor: 2.7 }),
    Object.freeze({ zoom: 15, factor: 2 }),
    Object.freeze({ zoom: 16, factor: 1.5 }),
    Object.freeze({ zoom: 17, factor: 1.2 }),
    Object.freeze({ zoom: 18, factor: 1 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'clamp',
    fallbackFactor: 1
  })
});
/* *************************************************************************** */