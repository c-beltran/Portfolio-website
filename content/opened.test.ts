import { describe, expect, it } from 'vitest';
import { DESK_OBJECTS } from './objects';
import {
  DIM_LEVEL,
  LEAN_FEATHER,
  MOVER_IDS,
  OPENED_IDS,
  artOf,
  artSrc,
  faceBox,
  isLean,
  isMover,
  openedFor,
  patchSrc,
  sideOf,
} from './opened';

/** The objects that come forward, and the ones the view leans in to. */
describe('opened objects', () => {
  it('are all thirteen: nine that come forward, then four to lean in to', () => {
    expect(OPENED_IDS).toEqual([
      'kit',
      'phone',
      'badge',
      'photo',
      'notepad',
      'card',
      'car',
      'ball',
      'mug',
      'monitor',
      'cv',
      'board',
      'diploma',
    ]);
    expect(OPENED_IDS.filter(isMover)).toEqual(MOVER_IDS);
  });

  it('every clickable section zooms or comes forward', () => {
    for (const o of DESK_OBJECTS) {
      expect(openedFor(o.slug)).toBe(o.id);
      expect(isMover(o.id) !== isLean(o.id)).toBe(true);
    }
    expect(openedFor(null)).toBeNull();
  });

  it('come out on the side they sit on', () => {
    expect(sideOf('kit')).toBe('left');
    expect(sideOf('phone')).toBe('right');
    expect(
      (
        [
          'badge',
          'photo',
          'notepad',
          'card',
          'car',
          'ball',
          'mug',
          'monitor',
          'cv',
          'board',
        ] as const
      ).map(sideOf),
    ).toEqual([
      'left',
      'right',
      'left',
      'right',
      'right',
      'left',
      'right',
      'left',
      'right',
      'left',
    ]);
  });

  it('name their art files', () => {
    expect(artSrc('kit', 'day', 800, 'avif')).toBe('/opened/kit-day-800.avif');
    expect(patchSrc('phone', 'lamp', 640, 'webp')).toBe('/opened/patch-phone-lamp-640.webp');
    expect(artOf('kit').widths).toEqual([800, 1600]);
  });

  it('patch the desk only for the objects that leave it', () => {
    for (const id of OPENED_IDS) expect(artOf(id).patch === undefined).toBe(isLean(id));
  });

  it('lay HTML on a face inside the art', () => {
    for (const id of ['phone', 'badge', 'card', 'monitor', 'cv', 'board', 'diploma'] as const) {
      const f = faceBox(id);
      const [l, t, w, h] = [f.left, f.top, f.width, f.height].map(parseFloat) as number[];
      expect(l).toBeGreaterThanOrEqual(0);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(l! + w!).toBeLessThanOrEqual(100);
      expect(t! + h!).toBeLessThanOrEqual(100);
      expect(f.transform).toMatch(/^matrix\(/);
    }
  });

  it('feather a lean-in by 6%', () => {
    expect(LEAN_FEATHER).toBe(0.06);
  });

  it('dim the desk to 0.45', () => {
    expect(DIM_LEVEL).toBe(0.45);
  });
});

describe('the diploma', () => {
  it('openedFor picks the diploma only when asked', () => {
    expect(openedFor('cv')).toBe('cv');
    expect(openedFor('cv', 'diploma')).toBe('diploma');
    expect(openedFor('travel', 'diploma')).toBe('board');
    expect(openedFor('cv', 'nonsense')).toBe('cv');
  });
});
