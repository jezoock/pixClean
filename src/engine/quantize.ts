import { redmeanDistSq, rgbToHex } from './color';
import type { PaletteEntry, QuantizationResult, RGB } from './types';

/**
 * Deterministic K-Means++ color quantization with perceptual Redmean distance (zero dithering).
 */
export function quantizeKMeans(pixels: Uint8ClampedArray, k: number): QuantizationResult {
  const pixelCount = pixels.length / 4;
  const assignments = new Int16Array(pixelCount).fill(-1);

  // Deduplicate unique opaque colors with weights for speed & determinism
  const colorMap = new Map<number, { r: number; g: number; b: number; weight: number }>();
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;
    const key = (pixels[idx] << 16) | (pixels[idx + 1] << 8) | pixels[idx + 2];
    const existing = colorMap.get(key);
    if (existing) {
      existing.weight++;
    } else {
      colorMap.set(key, { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2], weight: 1 });
    }
  }

  const uniqueColors = Array.from(colorMap.values()).sort((a, b) => b.weight - a.weight);
  if (uniqueColors.length === 0) {
    return { centroids: [], assignments };
  }

  const safeK = Math.max(1, Math.round(k));
  const actualK = Math.min(safeK, uniqueColors.length);

  // Deterministic K-Means++ initialization: first centroid = most frequent color, then farthest weighted
  const centroids: RGB[] = [[uniqueColors[0].r, uniqueColors[0].g, uniqueColors[0].b]];
  const minDists = new Float64Array(uniqueColors.length).fill(Infinity);

  while (centroids.length < actualK) {
    const last = centroids[centroids.length - 1];
    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < uniqueColors.length; i++) {
      const c = uniqueColors[i];
      const d = redmeanDistSq(c.r, c.g, c.b, last[0], last[1], last[2]);
      if (d < minDists[i]) minDists[i] = d;
      const score = minDists[i] * Math.sqrt(c.weight);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const next = uniqueColors[bestIdx];
    centroids.push([next.r, next.g, next.b]);
  }

  // Run K-Means iterations
  const colorCluster = new Int16Array(uniqueColors.length);
  const maxIter = 18;

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    const sumR = new Float64Array(actualK);
    const sumG = new Float64Array(actualK);
    const sumB = new Float64Array(actualK);
    const sumW = new Float64Array(actualK);

    for (let i = 0; i < uniqueColors.length; i++) {
      const c = uniqueColors[i];
      let bestC = 0;
      let bestD = Infinity;
      for (let j = 0; j < actualK; j++) {
        const d = redmeanDistSq(c.r, c.g, c.b, centroids[j][0], centroids[j][1], centroids[j][2]);
        if (d < bestD) {
          bestD = d;
          bestC = j;
        }
      }
      if (colorCluster[i] !== bestC) {
        colorCluster[i] = bestC;
        changed = true;
      }
      sumR[bestC] += c.r * c.weight;
      sumG[bestC] += c.g * c.weight;
      sumB[bestC] += c.b * c.weight;
      sumW[bestC] += c.weight;
    }

    for (let j = 0; j < actualK; j++) {
      if (sumW[j] > 0) {
        centroids[j] = [
          Math.round(sumR[j] / sumW[j]),
          Math.round(sumG[j] / sumW[j]),
          Math.round(sumB[j] / sumW[j]),
        ];
      }
    }

    if (!changed) break;
  }

  // Assign each pixel to its nearest centroid
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    if (pixels[idx + 3] === 0) continue;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    let bestC = 0;
    let bestD = Infinity;
    for (let j = 0; j < actualK; j++) {
      const d = redmeanDistSq(r, g, b, centroids[j][0], centroids[j][1], centroids[j][2]);
      if (d < bestD) {
        bestD = d;
        bestC = j;
      }
    }
    assignments[i] = bestC;
  }

  return { centroids, assignments };
}

/**
 * Counts pixel occurrences per centroid, sorts active palette entries by descending frequency,
 * applies optional user color overrides, and remaps pixel indices to the sorted palette.
 */
export function buildFrequencySortedPalette(
  centroids: readonly RGB[],
  indices: Int16Array,
  paletteOverrides?: ReadonlyMap<number, RGB>,
): { palette: PaletteEntry[]; remappedIndices: Int16Array } {
  const counts = new Int32Array(centroids.length);
  for (let i = 0; i < indices.length; i++) {
    const ci = indices[i];
    if (ci >= 0 && ci < counts.length) counts[ci]++;
  }

  const order = centroids
    .map((_, idx) => idx)
    .filter((idx) => counts[idx] > 0)
    .sort((a, b) => counts[b] - counts[a]);

  const remap = new Int16Array(centroids.length).fill(-1);
  order.forEach((oldIdx, newIdx) => {
    remap[oldIdx] = newIdx;
  });

  const palette: PaletteEntry[] = order.map((oldIdx, newIdx) => {
    const baseRgb = paletteOverrides?.get(newIdx) ?? centroids[oldIdx];
    const rgb: RGB = [baseRgb[0], baseRgb[1], baseRgb[2]];
    return {
      index: newIdx,
      rgb,
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      count: counts[oldIdx],
    };
  });

  const remappedIndices = new Int16Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const oldCi = indices[i];
    if (oldCi < 0 || oldCi >= remap.length || remap[oldCi] < 0) {
      remappedIndices[i] = -1;
    } else {
      remappedIndices[i] = remap[oldCi];
    }
  }

  return { palette, remappedIndices };
}
