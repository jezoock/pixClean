import { computeGridDimensions } from './grid-detect.ts';
import { createPixelBuffer, type GridGeometry, type PixelBuffer, type RGBA, type SamplingMode } from './types.ts';

/**
 * Samples a single grid cell using the selected anti-mixel method.
 */
export function sampleCell(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  size: number,
  mode: SamplingMode,
  alphaThreshold: number,
): RGBA {
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

/**
 * Downsamples a high-resolution source buffer onto a logical pixel grid using the specified anti-mixel sampling mode.
 */
export function sampleGrid(
  source: PixelBuffer,
  geometry: GridGeometry,
  mode: SamplingMode,
  alphaThreshold: number,
): PixelBuffer {
  const size = Math.max(1, geometry.pixelSize);
  const { gridWidth, gridHeight } = computeGridDimensions(source.width, source.height, geometry);
  const sampled = new Uint8ClampedArray(gridWidth * gridHeight * 4);

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const [r, g, b, a] = sampleCell(
        source.data,
        source.width,
        source.height,
        geometry.offsetX + gx * size,
        geometry.offsetY + gy * size,
        size,
        mode,
        alphaThreshold,
      );
      const outIdx = (gy * gridWidth + gx) * 4;
      sampled[outIdx] = r;
      sampled[outIdx + 1] = g;
      sampled[outIdx + 2] = b;
      sampled[outIdx + 3] = a;
    }
  }

  return createPixelBuffer(gridWidth, gridHeight, sampled);
}
