import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import bounds from './bounds-seat.json';

/** The resting terminal: three frames of its pane, drawn over the still once the page is idle. */
const loop = (() => {
  const p = join(process.cwd(), 'content/scene/screen-loop.json');
  return existsSync(p)
    ? (JSON.parse(readFileSync(p, 'utf8')) as {
        rect: { x0: number; y0: number; x1: number; y1: number };
        widths: number[];
        frames: number;
      })
    : null;
})();

describe('the terminal loop', () => {
  it('has its framing', () => {
    expect(loop).not.toBeNull();
    expect(loop!.frames).toBe(3);
    expect(loop!.widths).toHaveLength(2);
  });

  it('sits on the monitor’s left half', () => {
    const m = bounds.objects.obj_monitor;
    const r = loop!.rect;
    expect(r.x0).toBeGreaterThanOrEqual(m.x0 - 0.02);
    expect(r.x1).toBeLessThanOrEqual(m.x1 + 0.02);
    expect(r.y0).toBeGreaterThanOrEqual(m.y0 - 0.02);
    expect(r.y1).toBeLessThanOrEqual(m.y1 + 0.02);
    expect(r.x1 - r.x0).toBeLessThan(m.x1 - m.x0);
  });

  it('has every frame, in both modes and both sizes, each ≤ 40 kB', () => {
    for (let k = 1; k <= 3; k++)
      for (const mode of ['day', 'lamp'])
        for (const w of loop!.widths)
          for (const ext of ['avif', 'webp']) {
            const p = join(process.cwd(), `public/screens/terminal-${k}-${mode}-${w}.${ext}`);
            expect(existsSync(p), p).toBe(true);
            expect(statSync(p).size).toBeLessThanOrEqual(40 * 1024);
          }
  });
});
