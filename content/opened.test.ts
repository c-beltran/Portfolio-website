import { describe, expect, it } from 'vitest';
import { DIM_LEVEL, OPENED_IDS, artOf, artSrc, openedFor, patchSrc, sideOf } from './opened';

/** The objects that come forward. */
describe('opened objects', () => {
  it('are the kit and the phone', () => {
    expect(OPENED_IDS).toEqual(['kit', 'phone']);
  });

  it('come forward for their sections only', () => {
    expect(openedFor('potaflow')).toBe('kit');
    expect(openedFor('power-walk')).toBe('phone');
    expect(openedFor('about')).toBeNull();
    expect(openedFor(null)).toBeNull();
  });

  it('come out on the side they sit on', () => {
    expect(sideOf('kit')).toBe('left');
    expect(sideOf('phone')).toBe('right');
  });

  it('name their art files', () => {
    expect(artSrc('kit', 'day', 800, 'avif')).toBe('/opened/kit-day-800.avif');
    expect(patchSrc('phone', 'lamp', 640, 'webp')).toBe('/opened/patch-phone-lamp-640.webp');
    expect(artOf('kit').widths).toEqual([800, 1600]);
  });

  it('dim the desk to 0.45', () => {
    expect(DIM_LEVEL).toBe(0.45);
  });
});
