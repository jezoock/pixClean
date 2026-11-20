export {
  createPixelBuffer,
  type GridDimensions,
  type GridGeometry,
  type PaletteEntry,
  type PixelBuffer,
  type ProcessOptions,
  type ProcessResult,
  type QuantizationResult,
  type RGB,
  type RGBA,
  type SamplingMode,
} from './types.ts';

export { hexToRgb, redmeanDistSq, rgbToHex } from './color.ts';

export {
  autoDetectGrid,
  clampGridGeometry,
  computeGridDimensions,
  derivePixelSizeFromTargetWidth,
} from './grid-detect.ts';

export { sampleCell, sampleGrid } from './sampler.ts';

export { buildFrequencySortedPalette, quantizeKMeans } from './quantize.ts';

export { applyDespeckle } from './filters.ts';

export { renderIndexedBuffer, scaleNearestNeighbor } from './scaler.ts';

export { DEFAULT_PROCESS_OPTIONS, processPixelArt } from './pipeline.ts';
