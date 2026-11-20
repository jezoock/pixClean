import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hexToRgb, redmeanDistSq, rgbToHex } from '../../src/engine/index.ts';

describe('color utilities', () => {
  it('converts RGB values to uppercase hex with clamping and rounding', () => {
    assert.equal(rgbToHex(0, 0, 0), '#000000');
    assert.equal(rgbToHex(255, 255, 255), '#FFFFFF');
    assert.equal(rgbToHex(108, 140, 255), '#6C8CFF');
    assert.equal(rgbToHex(-10, 127.6, 300), '#0080FF');
  });

  it('parses 6-digit, 3-digit, prefixed, and unprefixed hex colors', () => {
    assert.deepEqual(hexToRgb('#6C8CFF'), [108, 140, 255]);
    assert.deepEqual(hexToRgb('1a2b3c'), [26, 43, 60]);
    assert.deepEqual(hexToRgb(' #f0a '), [255, 0, 170]);
  });

  it('computes symmetric perceptual Redmean distance with zero self-distance', () => {
    assert.equal(redmeanDistSq(42, 128, 200, 42, 128, 200), 0);
    assert.equal(
      redmeanDistSq(10, 20, 30, 100, 150, 200),
      redmeanDistSq(100, 150, 200, 10, 20, 30),
    );
    // Green channel carries higher perceptual weight than blue for equal delta
    const greenDiff = redmeanDistSq(128, 128, 128, 128, 148, 128);
    const blueDiff = redmeanDistSq(128, 128, 128, 128, 128, 148);
    assert.ok(greenDiff > blueDiff);
  });
});
