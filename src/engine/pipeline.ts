import { applyDespeckle } from './filters.ts';
import { buildFrequencySortedPalette, quantizeKMeans } from './quantize.ts';
import { sampleGrid } from './sampler.ts';
import { renderIndexedBuffer } from './scaler.ts';
import type { PixelBuffer, ProcessOptions, ProcessResult } from './types.ts';

export const DEFAULT_PROCESS_OPTIONS: Readonly<ProcessOptions> = Object.freeze({
  pixelSize: 8,
  offsetX: 0,
  offsetY: 0,
  samplingMode: 'mode',
  maxColors: 10,
  alphaThreshold: 128,
  despeckle: false,
});

/**
 * Full pure pixel-art cleaning pipeline:
 * 1. Anti-mixel grid cell sampling (`mode`, `center`, `median`, `average`)
 * 2. Deterministic K-Means++ quantization with perceptual Redmean distance
 * 3. Optional morphological despeckle pass
 * 4. Frequency-sorted palette assembly & optional color overrides
 * 5. RGBA `PixelBuffer` synthesis at native 1:1 logical grid resolution
 */
export function processPixelArt(source: PixelBuffer, options: ProcessOptions): ProcessResult {
  const sampled = sampleGrid(
    source,
    {
      pixelSize: options.pixelSize,
      offsetX: options.offsetX,
      offsetY: options.offsetY,
    },
    options.samplingMode,
    options.alphaThreshold,
  );

  const gridWidth = sampled.width;
  const gridHeight = sampled.height;

  const { centroids, assignments } = quantizeKMeans(sampled.data, options.maxColors);
  const filteredIndices = options.despeckle
    ? applyDespeckle(assignments, gridWidth, gridHeight)
    : assignments;

  const { palette, remappedIndices } = buildFrequencySortedPalette(
    centroids,
    filteredIndices,
    options.paletteOverrides,
  );

  const buffer = renderIndexedBuffer(remappedIndices, gridWidth, gridHeight, palette);

  return {
    gridWidth,
    gridHeight,
    indices: remappedIndices,
    buffer,
    palette,
  };
}
