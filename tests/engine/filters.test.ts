import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDespeckle } from '../../src/engine/index.ts';

describe('applyDespeckle', () => {
  it('replaces an isolated single pixel surrounded by >= 3 identical cardinal neighbors', () => {
    // 3x3 grid: center (1,1) is index 2 surrounded by 4 neighbors of index 0
    const indices = new Int16Array([
      0, 0, 0,
      0, 2, 0,
      0, 0, 0,
    ]);

    const out = applyDespeckle(indices, 3, 3);
    assert.equal(out[4], 0);
    // Input array is not mutated
    assert.equal(indices[4], 2);
  });

  it('preserves connected 2-pixel details and 1px lines', () => {
    const indices = new Int16Array([
      0, 0, 0, 0,
      0, 1, 1, 0,
      0, 0, 0, 0,
    ]);

    const out = applyDespeckle(indices, 4, 3);
    assert.deepEqual(Array.from(out), Array.from(indices));
  });

  it('does not alter a pixel when surrounding neighbors do not reach a 3-of-4 consensus', () => {
    const indices = new Int16Array([
      0, 1, 0,
      2, 9, 1,
      0, 2, 0,
    ]);

    const out = applyDespeckle(indices, 3, 3);
    assert.equal(out[4], 9);
  });
});
