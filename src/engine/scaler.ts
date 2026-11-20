import { createPixelBuffer, type PaletteEntry, type PixelBuffer } from './types';

/**
 * Renders an indexed pixel buffer (`-1` for transparent, `>= 0` for palette index) into an RGBA `PixelBuffer`.
 */
export function renderIndexedBuffer(
  indices: Int16Array,
  width: number,
  height: number,
  palette: readonly PaletteEntry[],
): PixelBuffer {
  const outData = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < indices.length; i++) {
    const ci = indices[i];
    if (ci < 0 || ci >= palette.length) continue;
    const [r, g, b] = palette[ci].rgb;
    const p = i * 4;
    outData[p] = r;
    outData[p + 1] = g;
    outData[p + 2] = b;
    outData[p + 3] = 255;
  }

  return createPixelBuffer(width, height, outData);
}

/**
 * Pure in-memory Nearest-Neighbor integer upscaler for `PixelBuffer` (zero DOM / Canvas dependency).
 */
export function scaleNearestNeighbor(source: PixelBuffer, scale: number): PixelBuffer {
  const factor = Math.max(1, Math.round(scale));
  if (factor === 1) {
    return createPixelBuffer(source.width, source.height, new Uint8ClampedArray(source.data));
  }

  const outWidth = source.width * factor;
  const outHeight = source.height * factor;
  const outData = new Uint8ClampedArray(outWidth * outHeight * 4);
  const srcData = source.data;

  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const srcIdx = (sy * source.width + sx) * 4;
      const r = srcData[srcIdx];
      const g = srcData[srcIdx + 1];
      const b = srcData[srcIdx + 2];
      const a = srcData[srcIdx + 3];

      const baseY = sy * factor;
      const baseX = sx * factor;

      for (let dy = 0; dy < factor; dy++) {
        const rowOffset = (baseY + dy) * outWidth;
        for (let dx = 0; dx < factor; dx++) {
          const dstIdx = (rowOffset + baseX + dx) * 4;
          outData[dstIdx] = r;
          outData[dstIdx + 1] = g;
          outData[dstIdx + 2] = b;
          outData[dstIdx + 3] = a;
        }
      }
    }
  }

  return createPixelBuffer(outWidth, outHeight, outData);
}
