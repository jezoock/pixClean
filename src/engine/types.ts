export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export type SamplingMode = 'mode' | 'center' | 'median' | 'average';

/**
 * Environment-agnostic RGBA pixel buffer (8-bit per channel, row-major).
 * Structurally compatible with browser `ImageData` without requiring DOM globals.
 */
export interface PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface GridGeometry {
  pixelSize: number;
  offsetX: number;
  offsetY: number;
}

export interface GridDimensions {
  gridWidth: number;
  gridHeight: number;
}

export interface ProcessOptions {
  pixelSize: number;
  offsetX: number;
  offsetY: number;
  samplingMode: SamplingMode;
  maxColors: number;
  alphaThreshold: number;
  despeckle: boolean;
  paletteOverrides?: ReadonlyMap<number, RGB>;
}

export interface PaletteEntry {
  index: number;
  rgb: RGB;
  hex: string;
  count: number;
}

export interface QuantizationResult {
  centroids: RGB[];
  assignments: Int16Array;
}

export interface ProcessResult {
  gridWidth: number;
  gridHeight: number;
  /** Indexed pixel buffer (-1 for transparent, >= 0 for palette index) */
  indices: Int16Array;
  /** RGBA pixel buffer at native grid resolution (1px per logical pixel, zero DOM dependency) */
  buffer: PixelBuffer;
  palette: PaletteEntry[];
}

/**
 * Allocates or wraps a pure RGBA `PixelBuffer` without any DOM `ImageData` dependency.
 */
export function createPixelBuffer(
  width: number,
  height: number,
  data?: Uint8ClampedArray,
): PixelBuffer {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const expectedLength = safeWidth * safeHeight * 4;

  if (data && data.length !== expectedLength) {
    throw new Error(
      `Invalid PixelBuffer data length: expected ${expectedLength} bytes for ${safeWidth}x${safeHeight}, got ${data.length}.`,
    );
  }

  return {
    width: safeWidth,
    height: safeHeight,
    data: data ?? new Uint8ClampedArray(expectedLength),
  };
}
