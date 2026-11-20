import { createPixelBuffer, scaleNearestNeighbor, type PixelBuffer } from '../engine';

/**
 * Supported browser/asset image inputs accepted by PixelClean adapters and editor.
 */
export type AssetImageInput =
  | Blob
  | File
  | ImageData
  | PixelBuffer
  | HTMLCanvasElement
  | HTMLImageElement
  | string;

function isPixelBufferLike(value: unknown): value is PixelBuffer {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PixelBuffer>;
  return (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    candidate.data instanceof Uint8ClampedArray
  );
}

/**
 * Converts a pure `PixelBuffer` into a browser `ImageData` instance.
 */
export function pixelBufferToImageData(buffer: PixelBuffer): ImageData {
  const clamped = new Uint8ClampedArray(buffer.data);
  return new ImageData(clamped, buffer.width, buffer.height);
}

/**
 * Wraps a browser `ImageData` object as a pure `PixelBuffer`.
 */
export function imageDataToPixelBuffer(imageData: ImageData): PixelBuffer {
  return createPixelBuffer(imageData.width, imageData.height, imageData.data);
}

/**
 * Extracts a `PixelBuffer` from an `HTMLCanvasElement`.
 */
export function canvasToPixelBuffer(canvas: HTMLCanvasElement): PixelBuffer {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D rendering context from source canvas.');
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageDataToPixelBuffer(imageData);
}

/**
 * Draws a `PixelBuffer` onto an `HTMLCanvasElement` (creating one if none is provided).
 */
export function pixelBufferToCanvas(
  buffer: PixelBuffer,
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = targetCanvas ?? document.createElement('canvas');
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D rendering context for target canvas.');
  }
  ctx.putImageData(pixelBufferToImageData(buffer), 0, 0);
  return canvas;
}

/**
 * Decodes an image `Blob` or `File` into an `HTMLCanvasElement`.
 */
export function loadBlobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('Unable to acquire 2D rendering context while decoding image.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image blob.'));
    };
    img.src = url;
  });
}

/**
 * Loads an image from a URL or data URI into an `HTMLCanvasElement`.
 */
export function loadUrlToCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to acquire 2D rendering context while loading image URL.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${url}`));
    };
    img.src = url;
  });
}

/**
 * Normalizes any supported `AssetImageInput` (Blob, File, URL, ImageData, PixelBuffer, Canvas, Image)
 * into an isolated `HTMLCanvasElement` without mutating the caller's source element.
 */
export async function loadImageInputToCanvas(input: AssetImageInput): Promise<HTMLCanvasElement> {
  if (typeof input === 'string') {
    return loadUrlToCanvas(input);
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return loadBlobToCanvas(input);
  }
  if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
    const clone = document.createElement('canvas');
    clone.width = input.width;
    clone.height = input.height;
    const ctx = clone.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire 2D rendering context while cloning canvas.');
    }
    ctx.drawImage(input, 0, 0);
    return clone;
  }
  if (typeof HTMLImageElement !== 'undefined' && input instanceof HTMLImageElement) {
    if (!input.complete) {
      await input.decode();
    }
    const canvas = document.createElement('canvas');
    canvas.width = input.naturalWidth || input.width;
    canvas.height = input.naturalHeight || input.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire 2D rendering context from HTMLImageElement.');
    }
    ctx.drawImage(input, 0, 0);
    return canvas;
  }
  if (isPixelBufferLike(input)) {
    return pixelBufferToCanvas(input);
  }
  throw new Error('Unsupported asset image input type.');
}

/**
 * Upscales a `PixelBuffer` using the pure engine Nearest-Neighbor scaler and encodes it to a PNG data URL.
 */
export function exportPixelBufferToPngDataUrl(
  buffer: PixelBuffer,
  scale = 1,
): { dataUrl: string; width: number; height: number; canvas: HTMLCanvasElement } {
  const scaled = scaleNearestNeighbor(buffer, scale);
  const canvas = pixelBufferToCanvas(scaled);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: scaled.width,
    height: scaled.height,
    canvas,
  };
}

/**
 * Upscales a `PixelBuffer` using the pure engine Nearest-Neighbor scaler and encodes it to a PNG `Blob`.
 */
export function exportPixelBufferToPngBlob(
  buffer: PixelBuffer,
  scale = 1,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scaled = scaleNearestNeighbor(buffer, scale);
  const canvas = pixelBufferToCanvas(scaled);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG blob from canvas.'));
        return;
      }
      resolve({
        blob,
        width: scaled.width,
        height: scaled.height,
      });
    }, 'image/png');
  });
}
