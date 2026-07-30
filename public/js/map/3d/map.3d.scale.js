const DEFAULT_FALLBACK_FACTOR = 1;
const VALID_EDGE_MODES = new Set(['clamp', 'exponential']);

function resolveFallbackFactor(edgePolicy) {
  const fallbackFactor = Number(edgePolicy?.fallbackFactor);

  return Number.isFinite(fallbackFactor) && fallbackFactor > 0
    ? fallbackFactor
    : DEFAULT_FALLBACK_FACTOR;
}

function isValidConfiguration(points, edgePolicy) {
  if (!Array.isArray(points) || points.length < 2) return false;
  if (
    !VALID_EDGE_MODES.has(edgePolicy?.below) ||
    !VALID_EDGE_MODES.has(edgePolicy?.above)
  ) {
    return false;
  }

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

function ensureValidFactor(factor, fallbackFactor) {
  return Number.isFinite(factor) && factor > 0
    ? factor
    : fallbackFactor;
}

export function resolveZoomScaleFactor(
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
