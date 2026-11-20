/**
 * Generates a 256x256 magic potion sprite intentionally corrupted with:
 * - 8px base pixel grid + 3px X / 2px Y phase offset
 * - Subtle vertical/radial AI gradients on flat surfaces
 * - Mixels (2px/4px stray details and slight anti-aliasing blur)
 */
export function generateCorruptedSampleSprite(): HTMLCanvasElement {
  const grid = 28;
  const scale = 8;
  const offsetX = 3;
  const offsetY = 2;
  const width = grid * scale + 16;
  const height = grid * scale + 16;

  // Base 28x28 potion sprite map
  const rows = [
    '............................',
    '...........OOOOOO...........',
    '..........OCCCCCBO..........',
    '..........OCCCCCBO..........',
    '...........OOOOOO...........',
    '..........OGGGGGGO..........',
    '..........OGLLLLGO..........',
    '...........OGGGGO...........',
    '..........OGLLLLGO..........',
    '.........OGGLLLLGGO.........',
    '........OGLLBBBBLLGO........',
    '.......OGLBBPPPPBBLGO.......',
    '......OGLBPPPPPPPBBLGO......',
    '.....OGLBPPHHPPPPPBBLGO.....',
    '.....OGLBPHHHPPPPPPBLGO.....',
    '.....OGLBPHHPPPPPPDDLGO.....',
    '.....OGLBPPPPPPPPDDDLGO.....',
    '.....OGLBPPPPPPPDDDDLGO.....',
    '.....OGLBPPPPPPDDDDDLGO.....',
    '......OGLBPPPPDDDDDLGO......',
    '.......OGLBBDDDDDDBGO.......',
    '........OGGLDDDDLGGO........',
    '.........OOGGGGGGOO.........',
    '...........OOOOOO...........',
    '............................',
    '............................',
    '............................',
    '............................',
  ];

  const baseColors: Record<string, [number, number, number]> = {
    O: [28, 22, 46],
    C: [184, 134, 84],
    B: [130, 88, 52],
    G: [132, 166, 198],
    L: [212, 232, 248],
    P: [62, 168, 238],
    H: [164, 232, 255],
    D: [34, 96, 178],
  };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Soft dark background with subtle gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#181a28');
  bg.addColorStop(1, '#221b36');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Draw cells with subtle AI-like per-pixel gradient drift
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const ch = rows[y]?.[x] ?? '.';
      if (ch === '.') continue;
      const [br, bgc, bb] = baseColors[ch];
      const px = offsetX + x * scale;
      const py = offsetY + y * scale;

      const cellGrad = ctx.createLinearGradient(px, py, px + scale, py + scale);
      const drift = Math.sin(x * 0.4 + y * 0.3) * 14;
      const r1 = Math.max(0, Math.min(255, Math.round(br + drift)));
      const g1 = Math.max(0, Math.min(255, Math.round(bgc + drift * 0.8)));
      const b1 = Math.max(0, Math.min(255, Math.round(bb - drift * 0.5)));
      const r2 = Math.max(0, Math.min(255, Math.round(br - drift * 0.7)));
      const g2 = Math.max(0, Math.min(255, Math.round(bgc - drift * 0.5)));
      const b2 = Math.max(0, Math.min(255, Math.round(bb + drift * 0.6)));

      cellGrad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      cellGrad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
      ctx.fillStyle = cellGrad;
      ctx.fillRect(px, py, scale, scale);
    }
  }

  // Inject intentional mixels (sub-grid misaligned artifacts & glow)
  ctx.fillStyle = 'rgba(164, 232, 255, 0.55)';
  ctx.fillRect(offsetX + 9 * scale + 2, offsetY + 13 * scale + 3, 3, 3);
  ctx.fillRect(offsetX + 14 * scale + 1, offsetY + 15 * scale + 5, 4, 2);
  ctx.fillStyle = 'rgba(28, 22, 46, 0.45)';
  ctx.fillRect(offsetX + 10 * scale - 2, offsetY + 11 * scale + 2, 3, 5);
  ctx.fillRect(offsetX + 17 * scale + 6, offsetY + 16 * scale + 1, 3, 4);

  // Apply slight blur pass to simulate AI upscaling softness
  const soft = document.createElement('canvas');
  soft.width = width;
  soft.height = height;
  const sctx = soft.getContext('2d')!;
  sctx.filter = 'blur(0.6px)';
  sctx.drawImage(canvas, 0, 0);
  sctx.filter = 'none';

  return soft;
}
