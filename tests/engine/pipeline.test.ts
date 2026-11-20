import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  autoDetectGrid,
  createPixelBuffer,
  DEFAULT_PROCESS_OPTIONS,
  processPixelArt,
  type PixelBuffer,
  type RGB,
} from '../../src/engine/index.ts';

function createSyntheticCorruptedSprite(): PixelBuffer {
  const grid = 16;
  const pixelSize = 6;
  const offsetX = 2;
  const offsetY = 1;
  const width = offsetX + grid * pixelSize + 4;
  const height = offsetY + grid * pixelSize + 4;
  const buffer = createPixelBuffer(width, height);

  const colors: Record<string, RGB> = {
    B: [24, 24, 42],
    O: [220, 140, 40],
    C: [60, 180, 240],
  };

  const map = [
    'BBBBBOOOOOOBBBBB',
    'BBBBOCCCCCCOBBBB',
    'BBBOCCOOOOCCOBBB',
    'BBOCOBBBBBOCOBBB',
    'BOCOBCCCCCCBOCOB',
    'OCOBCCOOOOCCBOOC',
    'OCOBCOCCCCOCBOCO',
    'OCOBCOCBBCOCBOCO',
    'OCOBCOCBBCOCBOCO',
    'OCOBCOCCCCOCBOCO',
    'OCOBCCOOOOCCBOOC',
    'BOCOBCCCCCCBOCOB',
    'BBOCOBBBBBOCOBBB',
    'BBBOCCOOOOCCOBBB',
    'BBBBOCCCCCCOBBBB',
    'BBBBBOOOOOOBBBBB',
  ];

  // Fill background with base color B
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      buffer.data[idx] = colors.B[0];
      buffer.data[idx + 1] = colors.B[1];
      buffer.data[idx + 2] = colors.B[2];
      buffer.data[idx + 3] = 255;
    }
  }

  // Paint each logical pixel with subtle AI-like gradient drift (+-3)
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const [r, g, b] = colors[map[gy][gx]];
      for (let dy = 0; dy < pixelSize; dy++) {
        for (let dx = 0; dx < pixelSize; dx++) {
          const x = offsetX + gx * pixelSize + dx;
          const y = offsetY + gy * pixelSize + dy;
          const drift = ((dx + dy) % 3) - 1;
          const idx = (y * width + x) * 4;
          buffer.data[idx] = r + drift;
          buffer.data[idx + 1] = g + drift;
          buffer.data[idx + 2] = b - drift;
          buffer.data[idx + 3] = 255;
        }
      }
    }
  }

  // Inject a small 2x2 mixel inside cyan cell (5,1)
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = offsetX + 5 * pixelSize + dx;
      const y = offsetY + 1 * pixelSize + dy;
      const idx = (y * width + x) * 4;
      buffer.data[idx] = 255;
      buffer.data[idx + 1] = 0;
      buffer.data[idx + 2] = 255;
      buffer.data[idx + 3] = 255;
    }
  }

  return buffer;
}

describe('processPixelArt end-to-end pipeline', () => {
  it('recovers grid, removes gradient drift and mixels, and produces a clean 3-color palette', () => {
    const source = createSyntheticCorruptedSprite();
    const detected = autoDetectGrid(source);

    assert.deepEqual(detected, { pixelSize: 6, offsetX: 2, offsetY: 1 });

    const result = processPixelArt(source, {
      ...DEFAULT_PROCESS_OPTIONS,
      ...detected,
      maxColors: 3,
      samplingMode: 'mode',
    });

    assert.equal(result.gridWidth, 16);
    assert.equal(result.gridHeight, 16);
    assert.equal(result.palette.length, 3);
    assert.equal(result.buffer.width, 16);
    assert.equal(result.buffer.height, 16);

    // Mixel inside cell (5,1) was ignored; cell (5,1) matches its neighbor (6,1)
    const idx51 = result.indices[1 * 16 + 5];
    const idx61 = result.indices[1 * 16 + 6];
    assert.equal(idx51, idx61);
  });

  it('applies paletteOverrides to the output RGBA buffer', () => {
    const source = createSyntheticCorruptedSprite();
    const overrideColor: RGB = [10, 250, 120];

    const result = processPixelArt(source, {
      ...DEFAULT_PROCESS_OPTIONS,
      pixelSize: 6,
      offsetX: 2,
      offsetY: 1,
      maxColors: 3,
      paletteOverrides: new Map([[0, overrideColor]]),
    });

    assert.deepEqual(result.palette[0].rgb, overrideColor);
    assert.equal(result.palette[0].hex, '#0AFA78');

    // Top-left cell (0,0) belongs to background (most frequent = palette index 0)
    assert.equal(result.indices[0], 0);
    assert.deepEqual(Array.from(result.buffer.data.slice(0, 4)), [10, 250, 120, 255]);
  });
});
