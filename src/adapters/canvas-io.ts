import { createPixelBuffer, scaleNearestNeighbor, type PixelBuffer } from '../engine';

/**
 * Converts a pure `PixelBuffer` into a browser `ImageData` instance.
 */
export function pixelBufferToImageData(buffer: PixelBuffer): ImageData {
  const clamped =
    buffer.data.byteOffset === 0 && buffer.data.byteLength === buffer.data.buffer.byteLength
      ? new Uint8ClampedArray(buffer.data)
      : new Uint8ClampedArray(buffer.data);
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
