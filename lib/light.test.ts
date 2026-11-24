import { describe, expect, it } from 'vitest';
import { defaultLamp, LAMP_STORAGE_KEY, LIGHT_SCRIPT, OLD_THEME_KEY, renderFor } from './light';

describe('the lamp and the render', () => {
  it('shows the lamp render only at night with the lamp on', () => {
    expect(renderFor('night', 'on')).toBe('lamp');
    expect(renderFor('night', 'off')).toBe('day');
    expect(renderFor('day', 'on')).toBe('day');
    expect(renderFor('day', 'off')).toBe('day');
  });

  it('starts with the lamp on at night and off by day', () => {
    expect(defaultLamp('night')).toBe('on');
    expect(defaultLamp('day')).toBe('off');
  });
});

/** A Date stand-in for one place: `now` in local fields, and the zone's January and July offsets. */
function fakeDate(
  now: { y: number; mo: number; d: number; h: number; mi: number },
  zone: { jan: number; jul: number; now: number },
) {
  return class {
    private args: number[];
    constructor(...args: number[]) {
      this.args = args;
    }
    getFullYear() {
      return now.y;
    }
    getMonth() {
      return now.mo;
    }
    getDate() {
      return now.d;
    }
    getHours() {
      return now.h;
    }
    getMinutes() {
      return now.mi;
    }
    getTimezoneOffset() {
      if (this.args.length === 0) return zone.now;
      return this.args[1] === 0 ? zone.jan : zone.jul;
    }
  };
}

const NEW_YORK = { jan: 300, jul: 240 };
const SYDNEY = { jan: -660, jul: -600 };
/** No daylight saving: the hemisphere can't be told, so the rule takes the equator's twelve hours. */
const SAO_PAULO = { jan: 180, jul: 180 };

function run(o: {
  at: { y: number; mo: number; d: number; h: number; mi?: number };
  zone?: { jan: number; jul: number };
  dst?: boolean;
  search?: string;
  lamp?: string | null;
  throws?: boolean;
}) {
  const z = o.zone ?? NEW_YORK;
  const north = z.jan > z.jul;
  const summer = o.at.mo >= 3 && o.at.mo <= 9;
  const inDst = o.dst ?? (north ? summer : !summer);
  const offsetNow = inDst ? Math.min(z.jan, z.jul) : Math.max(z.jan, z.jul);
  const removed: string[] = [];
  const blocked = () => {
    throw new Error('blocked');
  };
  const sessionStorage = {
    getItem: o.throws ? blocked : (k: string) => (k === LAMP_STORAGE_KEY ? (o.lamp ?? null) : null),
  };
  const localStorage = {
    removeItem: o.throws ? blocked : (k: string) => removed.push(k),
  };
  const location = { search: o.search ?? '' };
  const dataset: Record<string, string> = {};
  const D = fakeDate({ mi: 0, ...o.at }, { ...z, now: offsetNow });
  new Function('localStorage', 'sessionStorage', 'location', 'document', 'Date', LIGHT_SCRIPT)(
    localStorage,
    sessionStorage,
    location,
    { documentElement: { dataset } },
    D,
  );
  return { ...dataset, removed } as {
    time?: string;
    lamp?: string;
    theme?: string;
    removed: string[];
  };
}

describe('LIGHT_SCRIPT (before the first paint)', () => {
  it.each([
    [{ y: 2026, mo: 0, d: 15, h: 17, mi: 30 }, 'night'],
    [{ y: 2026, mo: 0, d: 15, h: 12 }, 'day'],
    [{ y: 2026, mo: 5, d: 21, h: 20 }, 'day'],
    [{ y: 2026, mo: 5, d: 21, h: 21 }, 'night'],
    [{ y: 2026, mo: 11, d: 21, h: 7 }, 'night'],
  ])('in New York at %o it is %s', (at, time) => {
    expect(run({ at }).time).toBe(time);
  });

  it('reads the season the right way round south of the equator', () => {
    // A December evening in Sydney is still light; a June one is dark.
    expect(run({ at: { y: 2026, mo: 11, d: 21, h: 19, mi: 30 }, zone: SYDNEY }).time).toBe('day');
    expect(run({ at: { y: 2026, mo: 5, d: 21, h: 19, mi: 30 }, zone: SYDNEY }).time).toBe('night');
  });

  it("gives zones without daylight saving the equator's day, not a mid-latitude one", () => {
    // A December 17:30 in São Paulo is daylight (sunset ~18:45); 40° would have called it night.
    expect(run({ at: { y: 2026, mo: 11, d: 21, h: 17, mi: 30 }, zone: SAO_PAULO }).time).toBe(
      'day',
    );
    expect(run({ at: { y: 2026, mo: 11, d: 21, h: 19, mi: 30 }, zone: SAO_PAULO }).time).toBe(
      'night',
    );
    expect(run({ at: { y: 2026, mo: 5, d: 21, h: 12 }, zone: SAO_PAULO }).time).toBe('day');
    expect(run({ at: { y: 2026, mo: 5, d: 21, h: 3 }, zone: SAO_PAULO }).time).toBe('night');
  });

  it('turns the lamp on at night unless this visit switched it off', () => {
    const night = { y: 2026, mo: 0, d: 15, h: 22 };
    expect(run({ at: night })).toMatchObject({ time: 'night', lamp: 'on', theme: 'lamp' });
    expect(run({ at: night, lamp: 'off' })).toMatchObject({ lamp: 'off', theme: 'day' });
    expect(run({ at: night, lamp: 'maybe' })).toMatchObject({ lamp: 'on', theme: 'lamp' });
  });

  it('takes a forced time from the address', () => {
    const noon = { y: 2026, mo: 5, d: 15, h: 12 };
    expect(run({ at: noon, search: '?time=night' })).toMatchObject({
      time: 'night',
      lamp: 'on',
      theme: 'lamp',
    });
    expect(run({ at: { ...noon, h: 23 }, search: '?time=twilight' }).time).toBe('day');
    expect(run({ at: noon, search: '?time=midnight' }).time).toBe('day');
  });

  it('forgets the old forever-saved theme', () => {
    expect(run({ at: { y: 2026, mo: 5, d: 15, h: 12 } }).removed).toEqual([OLD_THEME_KEY]);
    expect(OLD_THEME_KEY).toBe('desk-theme');
  });

  it('still sets all three when storage is blocked', () => {
    const r = run({ at: { y: 2026, mo: 0, d: 15, h: 23 }, throws: true });
    expect(r).toMatchObject({ time: 'night', lamp: 'on', theme: 'lamp' });
  });
});
