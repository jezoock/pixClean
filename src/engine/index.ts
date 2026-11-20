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
} from './types';

export { hexToRgb, redmeanDistSq, rgbToHex } from './color';

export {
  autoDetectGrid,
  clampGridGeometry,
  computeGridDimensions,
  derivePixelSizeFromTargetWidth,
} from './grid-detect';

export { sampleCell, sampleGrid } from './sampler';

export { buildFrequencySortedPalette, quantizeKMeans } from './quantize';

export { applyDespeckle } from './filters';

export { renderIndexedBuffer, scaleNearestNeighbor } from './scaler';

export { DEFAULT_PROCESS_OPTIONS, processPixelArt } from './pipeline';
