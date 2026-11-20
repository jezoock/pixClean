export type SamplingMode = 'mode' | 'center' | 'median' | 'average';

export interface ProcessOptions {
  pixelSize: number;
  offsetX: number;
  offsetY: number;
  samplingMode: SamplingMode;
  maxColors: number;
  alphaThreshold: number;
  despeckle: boolean;
  paletteOverrides: Map<number, [number, number, number]>;
}

export interface PaletteEntry {
  index: number;
  rgb: [number, number, number];
  hex: string;
  count: number;
}

export interface ProcessResult {
  gridWidth: number;
  gridHeight: number;
  /** Indexed pixel buffer (-1 for transparent, >= 0 for palette index) */
  indices: Int16Array;
  /** RGBA ImageData at native grid resolution (1px per logical pixel) */
  imageData: ImageData;
  palette: PaletteEntry[];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Perceptual Redmean squared distance */
function redmeanDistSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const rMean = (r1 + r2) * 0.5;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

/** Auto-detect dominant pixel size and X/Y phase offset via gradient autocorrelation */
export function autoDetectGrid(source: ImageData): { pixelSize: number; offsetX: number; offsetY: number } {
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

  const scorePeriod = (profile: Float64Array, period: number): { score: number; offset: number } => {
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
  };

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

/** Sample a single grid cell using the selected anti-mixel method */
function sampleCell(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  size: number,
  mode: SamplingMode,
  alphaThreshold: number,
): [number, number, number, number] {
  const xEnd = Math.min(width, Math.round(x0 + size));
  const yEnd = Math.min(height, Math.round(y0 + size));
  const xStart = Math.max(0, Math.round(x0));
  const yStart = Math.max(0, Math.round(y0));

  if (xStart >= xEnd || yStart >= yEnd) {
    return [0, 0, 0, 0];
  }

  if (mode === 'center') {
    const cx = Math.min(width - 1, Math.floor((xStart + xEnd) * 0.5));
    const cy = Math.min(height - 1, Math.floor((yStart + yEnd) * 0.5));
    const idx = (cy * width + cx) * 4;
    const a = data[idx + 3] >= alphaThreshold ? 255 : 0;
    return [data[idx], data[idx + 1], data[idx + 2], a];
  }

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let opaqueCount = 0;
  let totalCount = 0;

  // Quantized mode buckets (5-bit per channel) to ignore subtle compression/gradient noise
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      totalCount++;
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a >= alphaThreshold) {
        opaqueCount++;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        rs.push(r);
        gs.push(g);
        bs.push(b);

        if (mode === 'mode') {
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          const entry = buckets.get(key);
          if (entry) {
            entry.count++;
            entry.r += r;
            entry.g += g;
            entry.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }
      }
    }
  }

  if (opaqueCount * 2 < totalCount || opaqueCount === 0) {
    return [0, 0, 0, 0];
  }

  if (mode === 'mode') {
    let bestBucket = { count: -1, r: 0, g: 0, b: 0 };
    for (const b of buckets.values()) {
      if (b.count > bestBucket.count) bestBucket = b;
    }
    return [
      Math.round(bestBucket.r / bestBucket.count),
      Math.round(bestBucket.g / bestBucket.count),
      Math.round(bestBucket.b / bestBucket.count),
      255,
    ];
  }

  if (mode === 'median') {
    rs.sort((a, b) => a - b);
    gs.sort((a, b) => a - b);
    bs.sort((a, b) => a - b);
    const mid = Math.floor(rs.length / 2);
    return [rs[mid], gs[mid], bs[mid], 255];
  }

  // Average
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (let i = 0; i < rs.length; i++) {
    sr += rs[i];
    sg += gs[i];
    sb += bs[i];
  }
  return [Math.round(sr / rs.length), Math.round(sg / gs.length), Math.round(sb / bs.length), 255];
}

/** Deterministic K-Means++ quantization with perceptual Redmean distance (zero dithering) */
function quantizeKMeans(
  pixels: Uint8ClampedArray,
  k: number,
): { centroids: [number, number, number][]; assignments: Int16Array } {
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

  const actualK = Math.min(k, uniqueColors.length);

  // Deterministic K-Means++ initialization: first centroid = most frequent color, then farthest weighted
  const centroids: [number, number, number][] = [
    [uniqueColors[0].r, uniqueColors[0].g, uniqueColors[0].b],
  ];

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

/** Remove isolated single-pixel speckles that differ from all 4 cardinal neighbors */
function applyDespeckle(indices: Int16Array, width: number, height: number): Int16Array {
  const out = new Int16Array(indices);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const cur = indices[i];
      const n = indices[(y - 1) * width + x];
      const s = indices[(y + 1) * width + x];
      const w = indices[y * width + (x - 1)];
      const e = indices[y * width + (x + 1)];

      if (cur !== n && cur !== s && cur !== w && cur !== e) {
        const counts = new Map<number, number>();
        for (const nb of [n, s, w, e]) {
          counts.set(nb, (counts.get(nb) ?? 0) + 1);
        }
        let best = n;
        let maxC = 0;
        for (const [val, cnt] of counts.entries()) {
          if (cnt > maxC) {
            maxC = cnt;
            best = val;
          }
        }
        if (maxC >= 3) {
          out[i] = best;
        }
      }
    }
  }
  return out;
}

export function processPixelArt(source: ImageData, options: ProcessOptions): ProcessResult {
  const size = Math.max(1, options.pixelSize);
  const gridWidth = Math.max(1, Math.floor((source.width - options.offsetX) / size));
  const gridHeight = Math.max(1, Math.floor((source.height - options.offsetY) / size));

  const sampled = new Uint8ClampedArray(gridWidth * gridHeight * 4);

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const [r, g, b, a] = sampleCell(
        source.data,
        source.width,
        source.height,
        options.offsetX + gx * size,
        options.offsetY + gy * size,
        size,
        options.samplingMode,
        options.alphaThreshold,
      );
      const outIdx = (gy * gridWidth + gx) * 4;
      sampled[outIdx] = r;
      sampled[outIdx + 1] = g;
      sampled[outIdx + 2] = b;
      sampled[outIdx + 3] = a;
    }
  }

  const { centroids, assignments } = quantizeKMeans(sampled, options.maxColors);
  const finalIndices = options.despeckle
    ? applyDespeckle(assignments, gridWidth, gridHeight)
    : assignments;

  // Count pixels per palette entry
  const counts = new Int32Array(centroids.length);
  for (let i = 0; i < finalIndices.length; i++) {
    const ci = finalIndices[i];
    if (ci >= 0) counts[ci]++;
  }

  // Sort palette by frequency descending, keeping stable mapping
  const order = centroids
    .map((_, idx) => idx)
    .filter((idx) => counts[idx] > 0)
    .sort((a, b) => counts[b] - counts[a]);

  const remap = new Int16Array(centroids.length).fill(-1);
  order.forEach((oldIdx, newIdx) => {
    remap[oldIdx] = newIdx;
  });

  const palette: PaletteEntry[] = order.map((oldIdx, newIdx) => {
    const rgb = options.paletteOverrides.get(newIdx) ?? centroids[oldIdx];
    return {
      index: newIdx,
      rgb,
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      count: counts[oldIdx],
    };
  });

  const remappedIndices = new Int16Array(finalIndices.length);
  const outData = new Uint8ClampedArray(gridWidth * gridHeight * 4);

  for (let i = 0; i < finalIndices.length; i++) {
    const oldCi = finalIndices[i];
    if (oldCi < 0 || remap[oldCi] < 0) {
      remappedIndices[i] = -1;
      continue;
    }
    const newCi = remap[oldCi];
    remappedIndices[i] = newCi;
    const [r, g, b] = palette[newCi].rgb;
    const p = i * 4;
    outData[p] = r;
    outData[p + 1] = g;
    outData[p + 2] = b;
    outData[p + 3] = 255;
  }

  return {
    gridWidth,
    gridHeight,
    indices: remappedIndices,
    imageData: new ImageData(outData, gridWidth, gridHeight),
    palette,
  };
}
