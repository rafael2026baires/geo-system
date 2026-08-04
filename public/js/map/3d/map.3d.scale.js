const DEFAULT_FALLBACK_FACTOR = 1;
const VALID_EDGE_MODES = new Set(['clamp', 'exponential']);
const temporaryOverridesByPoints = new WeakMap();

function resolveFallbackFactor(edgePolicy) {
  const fallbackFactor = Number(edgePolicy?.fallbackFactor);

  return Number.isFinite(fallbackFactor) && fallbackFactor > 0
    ? fallbackFactor
    : DEFAULT_FALLBACK_FACTOR;
}

function isValidPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return false;

  return points.every((point, index) => {
    const isValidPoint =
      Number.isFinite(point?.zoom) &&
      Number.isFinite(point?.factor) &&
      point.factor > 0;
    const isStrictlyOrdered =
      index === 0 || point.zoom > points[index - 1].zoom;

    return isValidPoint && isStrictlyOrdered;
  });
}

function isValidConfiguration(points, edgePolicy) {
  if (!isValidPoints(points)) return false;
  if (
    !VALID_EDGE_MODES.has(edgePolicy?.below) ||
    !VALID_EDGE_MODES.has(edgePolicy?.above)
  ) {
    return false;
  }

  return true;
}

function ensureValidFactor(factor, fallbackFactor) {
  return Number.isFinite(factor) && factor > 0
    ? factor
    : fallbackFactor;
}

function resolveZoomScaleFactorFromPoints(
  currentZoom,
  points,
  edgePolicy = {}
) {
  const fallbackFactor = resolveFallbackFactor(edgePolicy);

  if (
    !Number.isFinite(currentZoom) ||
    !isValidConfiguration(points, edgePolicy)
  ) {
    return fallbackFactor;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (currentZoom < firstPoint.zoom) {
    const factor = edgePolicy.below === 'exponential'
      ? firstPoint.factor * (2 ** (firstPoint.zoom - currentZoom))
      : firstPoint.factor;

    return ensureValidFactor(factor, fallbackFactor);
  }

  if (currentZoom > lastPoint.zoom) {
    const factor = edgePolicy.above === 'exponential'
      ? lastPoint.factor * (2 ** (lastPoint.zoom - currentZoom))
      : lastPoint.factor;

    return ensureValidFactor(factor, fallbackFactor);
  }

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];

    if (currentZoom === point.zoom) {
      return point.factor;
    }

    if (currentZoom < point.zoom) {
      const previousPoint = points[index - 1];
      const t =
        (currentZoom - previousPoint.zoom) /
        (point.zoom - previousPoint.zoom);
      const factor = Math.exp(
        Math.log(previousPoint.factor) +
        (Math.log(point.factor) - Math.log(previousPoint.factor)) * t
      );

      return ensureValidFactor(factor, fallbackFactor);
    }
  }

  return ensureValidFactor(lastPoint.factor, fallbackFactor);
}

export function setTemporaryZoomScaleOverride(
  sourcePoints,
  temporaryPoints
) {
  if (!Array.isArray(sourcePoints)) {
    throw new TypeError('sourcePoints debe ser un array.');
  }

  const normalizedPoints = Array.isArray(temporaryPoints)
    ? temporaryPoints.map(point => ({
        zoom: Number(point?.zoom),
        factor: Number(point?.factor)
      }))
    : null;

  if (!isValidPoints(normalizedPoints)) {
    throw new TypeError(
      'temporaryPoints requiere al menos dos puntos, zooms crecientes y factores positivos.'
    );
  }

  const storedPoints = Object.freeze(
    normalizedPoints.map(point => Object.freeze({ ...point }))
  );
  temporaryOverridesByPoints.set(sourcePoints, storedPoints);

  return storedPoints;
}

export function clearTemporaryZoomScaleOverride(sourcePoints) {
  if (!Array.isArray(sourcePoints)) return false;
  return temporaryOverridesByPoints.delete(sourcePoints);
}

export function getTemporaryZoomScaleOverride(sourcePoints) {
  if (!Array.isArray(sourcePoints)) return null;
  return temporaryOverridesByPoints.get(sourcePoints) || null;
}

export function resolveZoomScaleFactorWithoutOverride(
  currentZoom,
  points,
  edgePolicy = {}
) {
  return resolveZoomScaleFactorFromPoints(currentZoom, points, edgePolicy);
}

export function resolveZoomScaleFactor(
  currentZoom,
  points,
  edgePolicy = {}
) {
  const effectivePoints =
    temporaryOverridesByPoints.get(points) || points;

  return resolveZoomScaleFactorFromPoints(
    currentZoom,
    effectivePoints,
    edgePolicy
  );
}
