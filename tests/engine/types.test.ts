import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPixelBuffer } from '../../src/engine/index.ts';

describe('createPixelBuffer', () => {
  it('allocates a zero-filled RGBA Uint8ClampedArray matching dimensions', () => {
    const buffer = createPixelBuffer(4, 3);
    assert.equal(buffer.width, 4);
    assert.equal(buffer.height, 3);
    assert.equal(buffer.data.length, 4 * 3 * 4);
    assert.ok(buffer.data.every((v) => v === 0));
  });

  it('clamps non-positive or fractional dimensions to at least 1', () => {
    const buffer = createPixelBuffer(0, -5);
    assert.equal(buffer.width, 1);
    assert.equal(buffer.height, 1);
    assert.equal(buffer.data.length, 4);
  });

  it('wraps an existing Uint8ClampedArray of the exact expected length', () => {
    const raw = new Uint8ClampedArray([255, 0, 128, 255, 10, 20, 30, 255]);
    const buffer = createPixelBuffer(2, 1, raw);
    assert.equal(buffer.data, raw);
    assert.equal(buffer.data[0], 255);
    assert.equal(buffer.data[2], 128);
  });

  it('throws when provided data length does not match width * height * 4', () => {
    assert.throws(
      () => createPixelBuffer(2, 2, new Uint8ClampedArray(8)),
      /Invalid PixelBuffer data length/,
    );
  });
});
