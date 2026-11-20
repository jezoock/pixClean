import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPixelBuffer, sampleCell, sampleGrid, type RGBA } from '../../src/engine/index.ts';

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgba: RGBA,
): void {
  const idx = (y * width + x) * 4;
  data[idx] = rgba[0];
  data[idx + 1] = rgba[1];
  data[idx + 2] = rgba[2];
  data[idx + 3] = rgba[3];
}

describe('anti-mixel grid sampler', () => {
  it('mode sampling picks the dominant 5-bit color bucket and ignores minority mixels', () => {
    const buf = createPixelBuffer(4, 4);
    // Fill 4x4 cell with blue (#3080E0) + slight 1-2 LSB noise
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        setPixel(buf.data, 4, x, y, [48 + (x % 2), 128 + (y % 2), 224, 255]);
      }
    }
    // Inject 3 bright red mixel pixels
    setPixel(buf.data, 4, 0, 0, [255, 0, 0, 255]);
    setPixel(buf.data, 4, 1, 0, [255, 0, 0, 255]);
    setPixel(buf.data, 4, 0, 1, [255, 0, 0, 255]);

    const [r, g, b, a] = sampleCell(buf.data, 4, 4, 0, 0, 4, 'mode', 128);
    assert.equal(a, 255);
    assert.ok(r >= 48 && r <= 50);
    assert.ok(g >= 128 && g <= 130);
    assert.equal(b, 224);
  });

  it('center, median, and average modes behave according to their definitions', () => {
    const buf = createPixelBuffer(3, 3);
    // 8 pixels of (10, 20, 30), center pixel (1,1) = (190, 200, 210)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        setPixel(buf.data, 3, x, y, [10, 20, 30, 255]);
      }
    }
    setPixel(buf.data, 3, 1, 1, [190, 200, 210, 255]);

    assert.deepEqual(sampleCell(buf.data, 3, 3, 0, 0, 3, 'center', 128), [190, 200, 210, 255]);
    assert.deepEqual(sampleCell(buf.data, 3, 3, 0, 0, 3, 'median', 128), [10, 20, 30, 255]);
    assert.deepEqual(sampleCell(buf.data, 3, 3, 0, 0, 3, 'average', 128), [30, 40, 50, 255]);
  });

  it('returns transparent when fewer than half of the cell pixels pass alphaThreshold', () => {
    const buf = createPixelBuffer(2, 2);
    // Only 1 of 4 pixels is opaque
    setPixel(buf.data, 2, 0, 0, [255, 255, 255, 255]);
    setPixel(buf.data, 2, 1, 0, [255, 255, 255, 100]);
    setPixel(buf.data, 2, 0, 1, [255, 255, 255, 0]);
    setPixel(buf.data, 2, 1, 1, [255, 255, 255, 50]);

    assert.deepEqual(sampleCell(buf.data, 2, 2, 0, 0, 2, 'mode', 128), [0, 0, 0, 0]);
  });

  it('sampleGrid downsamples a 2x2 block grid with offset cleanly', () => {
    const buf = createPixelBuffer(5, 5);
    // Offset (1,1), pixelSize=2 -> 2x2 logical grid covering x in [1..4], y in [1..4]
    const colors: RGBA[][] = [
      [
        [200, 0, 0, 255],
        [0, 200, 0, 255],
      ],
      [
        [0, 0, 200, 255],
        [200, 200, 0, 255],
      ],
    ];
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            setPixel(buf.data, 5, 1 + gx * 2 + dx, 1 + gy * 2 + dy, colors[gy][gx]);
          }
        }
      }
    }

    const sampled = sampleGrid(buf, { pixelSize: 2, offsetX: 1, offsetY: 1 }, 'mode', 128);
    assert.equal(sampled.width, 2);
    assert.equal(sampled.height, 2);
    assert.deepEqual(Array.from(sampled.data.slice(0, 4)), [200, 0, 0, 255]);
    assert.deepEqual(Array.from(sampled.data.slice(4, 8)), [0, 200, 0, 255]);
    assert.deepEqual(Array.from(sampled.data.slice(8, 12)), [0, 0, 200, 255]);
    assert.deepEqual(Array.from(sampled.data.slice(12, 16)), [200, 200, 0, 255]);
  });
});
