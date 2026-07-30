export const MAIN_MAP_LOCATION_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 13, factor: 5.2 }),
    Object.freeze({ zoom: 15, factor: 2.30 }),
    Object.freeze({ zoom: 16, factor: 0.80 }),
    Object.freeze({ zoom: 18, factor: 0.60 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'clamp',
    fallbackFactor: 1
  })
});

export const MAIN_MAP_VEHICLE_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 13, factor: 16.0 }),
    Object.freeze({ zoom: 15, factor: 4.0 }),
    Object.freeze({ zoom: 16, factor: 2.7 }),
    Object.freeze({ zoom: 18, factor: 1.4 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'clamp',
    fallbackFactor: 1
  })
});

// Valores iniciales de migración; requieren calibración visual posterior.
export const FLOATING_MAP_VEHICLE_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 12, factor: 11.0 }),
    Object.freeze({ zoom: 13, factor: 8.0 }),
    Object.freeze({ zoom: 15, factor: 4.0}),
    Object.freeze({ zoom: 16, factor: 5.0 }),
    Object.freeze({ zoom: 18, factor: 0.8 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'clamp',
    fallbackFactor: 1
  })
});

// Perfil neutral inicial: conserva el factor visual actual en el rango operativo.
export const FLOATING_MAP_LOCATION_SCALE_PROFILE = Object.freeze({
  enabled: true,
  points: Object.freeze([
    Object.freeze({ zoom: 15, factor: 1 }),
    Object.freeze({ zoom: 18, factor: 1 })
  ]),
  edgePolicy: Object.freeze({
    below: 'exponential',
    above: 'clamp',
    fallbackFactor: 1
  })
});
