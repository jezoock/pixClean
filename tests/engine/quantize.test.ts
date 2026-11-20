import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFrequencySortedPalette,
  quantizeKMeans,
  type RGB,
} from '../../src/engine/index.ts';

describe('K-Means++ quantization & palette builder', () => {
  it('collapses subtle color variations into k flat centroids deterministically', () => {
    // 6 reddish pixels + 4 bluish pixels + 2 transparent pixels
    const pixels = new Uint8ClampedArray([
      220, 40, 40, 255,
      222, 42, 38, 255,
      218, 39, 41, 255,
      221, 41, 40, 255,
      219, 38, 42, 255,
      220, 40, 39, 255,
      30, 120, 230, 255,
      32, 118, 228, 255,
      28, 122, 232, 255,
      30, 120, 230, 255,
      0, 0, 0, 0,
      255, 255, 255, 0,
    ]);

    const first = quantizeKMeans(pixels, 2);
    const second = quantizeKMeans(pixels, 2);

    assert.equal(first.centroids.length, 2);
    assert.deepEqual(first.centroids, second.centroids);
    assert.deepEqual(Array.from(first.assignments), Array.from(second.assignments));

    // Transparent pixels stay -1
    assert.equal(first.assignments[10], -1);
    assert.equal(first.assignments[11], -1);

    // First 6 pixels share one cluster, next 4 share the other
    const redCluster = first.assignments[0];
    const blueCluster = first.assignments[6];
    assert.notEqual(redCluster, blueCluster);
    for (let i = 0; i < 6; i++) assert.equal(first.assignments[i], redCluster);
    for (let i = 6; i < 10; i++) assert.equal(first.assignments[i], blueCluster);
  });

  it('handles fully transparent images without error', () => {
    const empty = new Uint8ClampedArray(16);
    const { centroids, assignments } = quantizeKMeans(empty, 8);
    assert.deepEqual(centroids, []);
    assert.deepEqual(Array.from(assignments), [-1, -1, -1, -1]);
  });

  it('sorts palette by descending pixel frequency and applies paletteOverrides cleanly', () => {
    const centroids: RGB[] = [
      [10, 10, 10], // 1 px
      [255, 0, 0], // 3 px (most frequent -> new index 0)
      [0, 255, 0], // 0 px (unused -> dropped)
      [0, 0, 255], // 2 px (second -> new index 1)
    ];
    const indices = new Int16Array([1, 1, 1, 3, 3, 0, -1]);
    const overrides = new Map<number, RGB>([[1, [255, 255, 0]]]);

    const { palette, remappedIndices } = buildFrequencySortedPalette(centroids, indices, overrides);

    assert.equal(palette.length, 3);
    assert.deepEqual(palette[0], { index: 0, rgb: [255, 0, 0], hex: '#FF0000', count: 3 });
    assert.deepEqual(palette[1], { index: 1, rgb: [255, 255, 0], hex: '#FFFF00', count: 2 });
    assert.deepEqual(palette[2], { index: 2, rgb: [10, 10, 10], hex: '#0A0A0A', count: 1 });
    assert.deepEqual(Array.from(remappedIndices), [0, 0, 0, 1, 1, 2, -1]);
  });
});
