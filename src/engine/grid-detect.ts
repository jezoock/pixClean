import type { GridDimensions, GridGeometry, PixelBuffer } from './types.ts';

/**
 * Clamps grid geometry so offsets remain strictly within `[0, pixelSize - 1]`.
 */
export function clampGridGeometry(
  geometry: GridGeometry,
  minSize = 1,
  maxSize = 32,
): GridGeometry {
  const pixelSize = Math.max(minSize, Math.min(maxSize, Math.round(geometry.pixelSize)));
  const maxOffset = Math.max(0, pixelSize - 1);
  const offsetX = Math.max(0, Math.min(maxOffset, Math.round(geometry.offsetX)));
  const offsetY = Math.max(0, Math.min(maxOffset, Math.round(geometry.offsetY)));
  return { pixelSize, offsetX, offsetY };
}

/**
 * Computes the logical pixel grid dimensions (`gridWidth`, `gridHeight`) from a source dimensions and grid geometry.
 */
export function computeGridDimensions(
  sourceWidth: number,
  sourceHeight: number,
  geometry: GridGeometry,
): GridDimensions {
  const size = Math.max(1, geometry.pixelSize);
  const gridWidth = Math.max(1, Math.floor((sourceWidth - geometry.offsetX) / size));
  const gridHeight = Math.max(1, Math.floor((sourceHeight - geometry.offsetY) / size));
  return { gridWidth, gridHeight };
}

/**
 * Derives the source pixel size corresponding to a desired logical grid width.
 */
export function derivePixelSizeFromTargetWidth(
  sourceWidth: number,
  offsetX: number,
  targetGridWidth: number,
  minSize = 1,
  maxSize = 32,
): number {
  const safeTargetWidth = Math.max(1, Math.round(targetGridWidth));
  const derived = Math.round((sourceWidth - offsetX) / safeTargetWidth);
  return Math.max(minSize, Math.min(maxSize, derived));
}

function scorePeriod(profile: Float64Array, period: number): { score: number; offset: number } {
  let bestOffset = 0;
  let bestPeak = -1;
  let totalMean = 0;
  for (let i = 1; i < profile.length; i++) totalMean += profile[i];
  totalMean /= Math.max(1, profile.length - 1);
  if (totalMean === 0) return { score: 0, offset: 0 };

  for (let off = 0; off < period; off++) {
    let sum = 0;
    let count = 0;
    for (let pos = off; pos < profile.length; pos += period) {
      if (pos > 0) {
        sum += profile[pos];
        count++;
      }
    }
    const avg = count > 0 ? sum / count : 0;
    if (avg > bestPeak) {
      bestPeak = avg;
      bestOffset = off;
    }
  }
  return { score: bestPeak / totalMean, offset: bestOffset };
}

/**
 * Auto-detects the dominant pixel size and X/Y phase offset via gradient autocorrelation.
 */
export function autoDetectGrid(source: PixelBuffer): GridGeometry {
  const { width, height, data } = source;
  const maxStep = Math.min(32, Math.floor(Math.min(width, height) / 4));
  if (maxStep < 2) {
    return { pixelSize: 1, offsetX: 0, offsetY: 0 };
  }

  // Horizontal & vertical gradient energy profiles
  const gradX = new Float64Array(width);
  const gradY = new Float64Array(height);

  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const i1 = (y * width + x) * 4;
      const i0 = (y * width + (x - 1)) * 4;
      const diff =
        Math.abs(data[i1] - data[i0]) +
        Math.abs(data[i1 + 1] - data[i0 + 1]) +
        Math.abs(data[i1 + 2] - data[i0 + 2]) +
        Math.abs(data[i1 + 3] - data[i0 + 3]);
      gradX[x] += diff;
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 1; y < height; y++) {
      const i1 = (y * width + x) * 4;
      const i0 = ((y - 1) * width + x) * 4;
      const diff =
        Math.abs(data[i1] - data[i0]) +
        Math.abs(data[i1 + 1] - data[i0 + 1]) +
        Math.abs(data[i1 + 2] - data[i0 + 2]) +
        Math.abs(data[i1 + 3] - data[i0 + 3]);
      gradY[y] += diff;
    }
  }

  let bestSize = 4;
  let bestScore = -1;
  let bestOx = 0;
  let bestOy = 0;

  for (let p = 2; p <= maxStep; p++) {
    const sx = scorePeriod(gradX, p);
    const sy = scorePeriod(gradY, p);
    // Slight preference for smaller fundamental periods over harmonics
    const combined = (sx.score + sy.score) * 0.5 * (1 - p * 0.004);
    if (combined > bestScore) {
      bestScore = combined;
      bestSize = p;
      bestOx = sx.offset;
      bestOy = sy.offset;
    }
  }

  return {
    pixelSize: bestSize,
    offsetX: bestOx,
    offsetY: bestOy,
  };
}
