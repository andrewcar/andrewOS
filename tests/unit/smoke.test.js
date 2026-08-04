import { describe, expect, it } from 'vitest';
import { assertColorNear, samplePixels } from '../helpers/samplePixels.js';
import { PNG } from 'pngjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('test infrastructure smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('samplePixels reads RGB at normalized coordinates', () => {
    const png = new PNG({ width: 10, height: 10 });
    // Fill cream #FAF4E8
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const i = (10 * y + x) << 2;
        png.data[i] = 0xfa;
        png.data[i + 1] = 0xf4;
        png.data[i + 2] = 0xe8;
        png.data[i + 3] = 255;
      }
    }
    const dir = mkdtempSync(join(tmpdir(), 'andrewos-'));
    const path = join(dir, 'cream.png');
    writeFileSync(path, PNG.sync.write(png));

    const [center] = samplePixels(path, [{ label: 'center', x: 0.5, y: 0.5 }]);
    expect(center.r).toBe(0xfa);
    expect(center.g).toBe(0xf4);
    expect(center.b).toBe(0xe8);
    assertColorNear(center, '#FAF4E8', 0);
  });
});
