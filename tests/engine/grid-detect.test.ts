import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  autoDetectGrid,
  clampGridGeometry,
  computeGridDimensions,
  createPixelBuffer,
  derivePixelSizeFromTargetWidth,
  type PixelBuffer,
  type RGB,
} from '../../src/engine/index.ts';

function buildCheckerboardBuffer(
  gridW: number,
  gridH: number,
  pixelSize: number,
  offsetX: number,
  offsetY: number,
): PixelBuffer {
  const width = offsetX + gridW * pixelSize + pixelSize;
  const height = offsetY + gridH * pixelSize + pixelSize;
  const buffer = createPixelBuffer(width, height);
  const palette: RGB[] = [
    [28, 22, 46],
    [62, 168, 238],
    [212, 232, 248],
    [184, 134, 84],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = Math.floor((x - offsetX) / pixelSize);
      const gy = Math.floor((y - offsetY) / pixelSize);
      const color = palette[((gx * 3 + gy * 5) % palette.length + palette.length) % palette.length];
      const idx = (y * width + x) * 4;
      buffer.data[idx] = color[0];
      buffer.data[idx + 1] = color[1];
      buffer.data[idx + 2] = color[2];
      buffer.data[idx + 3] = 255;
    }
  }
  return buffer;
}

describe('grid geometry & auto-detection', () => {
  it('clamps pixelSize and ensures offsets stay within [0, pixelSize - 1]', () => {
    assert.deepEqual(clampGridGeometry({ pixelSize: 8, offsetX: 12, offsetY: -3 }), {
      pixelSize: 8,
      offsetX: 7,
      offsetY: 0,
    });
    assert.deepEqual(clampGridGeometry({ pixelSize: 0, offsetX: 5, offsetY: 5 }), {
      pixelSize: 1,
      offsetX: 0,
      offsetY: 0,
    });
    assert.deepEqual(clampGridGeometry({ pixelSize: 99, offsetX: 40, offsetY: 10 }, 1, 32), {
      pixelSize: 32,
      offsetX: 31,
      offsetY: 10,
    });
  });

  it('computes logical grid dimensions and derives pixel size from target width', () => {
    assert.deepEqual(computeGridDimensions(240, 240, { pixelSize: 8, offsetX: 3, offsetY: 2 }), {
      gridWidth: 29,
      gridHeight: 29,
    });
    assert.equal(derivePixelSizeFromTargetWidth(240, 3, 29), 8);
    assert.equal(derivePixelSizeFromTargetWidth(240, 0, 1000, 1, 32), 1);
    assert.equal(derivePixelSizeFromTargetWidth(240, 0, 1, 1, 32), 32);
  });

  it('auto-detects exact pixelSize and phase offsets on synthetic grids', () => {
    const buf8 = buildCheckerboardBuffer(24, 24, 8, 3, 2);
    assert.deepEqual(autoDetectGrid(buf8), { pixelSize: 8, offsetX: 3, offsetY: 2 });

    const buf5 = buildCheckerboardBuffer(20, 20, 5, 1, 4);
    assert.deepEqual(autoDetectGrid(buf5), { pixelSize: 5, offsetX: 1, offsetY: 4 });
  });

  it('falls back safely on tiny buffers', () => {
    const tiny = createPixelBuffer(4, 4);
    assert.deepEqual(autoDetectGrid(tiny), { pixelSize: 1, offsetX: 0, offsetY: 0 });
  });
});
