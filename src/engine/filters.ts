/**
 * Removes isolated single-pixel speckles that differ from all 4 cardinal neighbors
 * when at least 3 neighbors share the same palette index.
 */
export function applyDespeckle(indices: Int16Array, width: number, height: number): Int16Array {
  const out = new Int16Array(indices);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const cur = indices[i];
      const n = indices[(y - 1) * width + x];
      const s = indices[(y + 1) * width + x];
      const w = indices[y * width + (x - 1)];
      const e = indices[y * width + (x + 1)];

      if (cur !== n && cur !== s && cur !== w && cur !== e) {
        const counts = new Map<number, number>();
        for (const nb of [n, s, w, e]) {
          counts.set(nb, (counts.get(nb) ?? 0) + 1);
        }
        let best = n;
        let maxC = 0;
        for (const [val, cnt] of counts.entries()) {
          if (cnt > maxC) {
            maxC = cnt;
            best = val;
          }
        }
        if (maxC >= 3) {
          out[i] = best;
        }
      }
    }
  }
  return out;
}
