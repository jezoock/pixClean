import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPixelBuffer,
  renderIndexedBuffer,
  scaleNearestNeighbor,
  type PaletteEntry,
} from '../../src/engine/index.ts';

describe('renderIndexedBuffer & scaleNearestNeighbor', () => {
  it('renders indexed pixels to RGBA while keeping -1 transparent', () => {
    const palette: PaletteEntry[] = [
      { index: 0, rgb: [255, 0, 0], hex: '#FF0000', count: 2 },
      { index: 1, rgb: [0, 128, 255], hex: '#0080FF', count: 1 },
    ];
    const indices = new Int16Array([0, -1, 1, 0]);
    const buffer = renderIndexedBuffer(indices, 2, 2, palette);

    assert.equal(buffer.width, 2);
    assert.equal(buffer.height, 2);
    assert.deepEqual(Array.from(buffer.data), [
      255, 0, 0, 255,
      0, 0, 0, 0,
      0, 128, 255, 255,
      255, 0, 0, 255,
    ]);
  });

  it('clones buffer cleanly at scale 1 without aliasing source data', () => {
    const src = createPixelBuffer(1, 1, new Uint8ClampedArray([10, 20, 30, 255]));
    const scaled = scaleNearestNeighbor(src, 1);

    assert.equal(scaled.width, 1);
    assert.equal(scaled.height, 1);
    assert.notEqual(scaled.data, src.data);
    assert.deepEqual(Array.from(scaled.data), [10, 20, 30, 255]);
  });

  it('upscales pixels with crisp nearest-neighbor blocks and preserves transparency', () => {
    const src = createPixelBuffer(
      2,
      1,
      new Uint8ClampedArray([
        255, 10, 20, 255,
        0, 0, 0, 0,
      ]),
    );
    const scaled = scaleNearestNeighbor(src, 2);

    assert.equal(scaled.width, 4);
    assert.equal(scaled.height, 2);

    // Row 0: [red, red, transparent, transparent]
    assert.deepEqual(Array.from(scaled.data.slice(0, 16)), [
      255, 10, 20, 255,
      255, 10, 20, 255,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    // Row 1 identical to Row 0
    assert.deepEqual(
      Array.from(scaled.data.slice(16, 32)),
      Array.from(scaled.data.slice(0, 16)),
    );
  });
});
