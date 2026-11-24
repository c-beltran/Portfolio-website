import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_KEY,
  CACHE_MS,
  fetchWeather,
  overrideFrom,
  TIMEOUT_MS,
  weatherUrl,
} from './fetchWeather';

const HERE = { lat: 40.71, lon: -74.01 };
const RAIN = {
  current: { weather_code: 63, cloud_cover: 100, wind_speed_10m: 5.5, wind_direction_10m: 200 },
};

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

afterEach(() => vi.useRealTimers());

describe('weatherUrl', () => {
  it('asks for the current weather at the place, wind in m/s, and not for day or night', () => {
    const u = new URL(weatherUrl(HERE));
    expect(u.origin + u.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(u.searchParams.get('latitude')).toBe('40.71');
    expect(u.searchParams.get('longitude')).toBe('-74.01');
    expect(u.searchParams.get('current')).toBe(
      'weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    );
    expect(u.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(u.toString()).not.toContain('is_day');
  });
});

describe('fetchWeather', () => {
  it('reads the condition and the wind', async () => {
    const r = await fetchWeather(HERE, { fetch: ok(RAIN), storage: memory(), now: 0 });
    expect(r).toEqual({ condition: 'rain', intensity: 0.75, windMs: 5.5, windDeg: 200 });
  });

  it('asks once per 30 minutes at the same place', async () => {
    const storage = memory();
    const f = ok(RAIN);
    await fetchWeather(HERE, { fetch: f, storage, now: 0 });
    await fetchWeather(HERE, { fetch: f, storage, now: 29 * 60_000 });
    expect(f).toHaveBeenCalledTimes(1);
    await fetchWeather(HERE, { fetch: f, storage, now: 31 * 60_000 });
    expect(f).toHaveBeenCalledTimes(2);
    expect(CACHE_MS).toBe(30 * 60_000);
  });

  it('asks again for another place', async () => {
    const storage = memory();
    const f = ok(RAIN);
    await fetchWeather(HERE, { fetch: f, storage, now: 0 });
    await fetchWeather({ lat: 51.51, lon: -0.13 }, { fetch: f, storage, now: 1000 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('asks again over a spoiled cache, and over storage that throws', async () => {
    const storage = memory();
    storage.setItem(CACHE_KEY, '{nope');
    const f = ok(RAIN);
    expect(await fetchWeather(HERE, { fetch: f, storage, now: 0 })).not.toBeNull();
    const throwing = {
      ...memory(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as Storage;
    expect(await fetchWeather(HERE, { fetch: f, storage: throwing, now: 0 })).not.toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('gives nothing for a failed, malformed or unknown answer', async () => {
    const bad = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    expect(await fetchWeather(HERE, { fetch: bad, storage: null, now: 0 })).toBeNull();
    const junk = vi.fn(
      async () => new Response('not json', { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await fetchWeather(HERE, { fetch: junk, storage: null, now: 0 })).toBeNull();
    expect(
      await fetchWeather(HERE, {
        fetch: ok({ current: { weather_code: 42 } }),
        storage: null,
        now: 0,
      }),
    ).toBeNull();
    expect(await fetchWeather(HERE, { fetch: ok({}), storage: null, now: 0 })).toBeNull();
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect(await fetchWeather(HERE, { fetch: down, storage: null, now: 0 })).toBeNull();
  });

  it('gives up after 4 seconds', async () => {
    vi.useFakeTimers();
    const never = vi.fn(
      (_: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    ) as unknown as typeof fetch;
    const r = fetchWeather(HERE, { fetch: never, storage: null, now: 0 });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect(await r).toBeNull();
    expect(TIMEOUT_MS).toBe(4000);
  });
});

describe('overrideFrom (the review override in the address)', () => {
  it('forces a condition and a time', () => {
    expect(overrideFrom('?weather=rain&time=night')).toEqual({ condition: 'rain', time: 'night' });
    expect(overrideFrom('?tier=2&time=twilight')).toEqual({ time: 'twilight' });
  });

  it('ignores anything else', () => {
    expect(overrideFrom('?weather=hail&time=noon')).toEqual({});
    expect(overrideFrom('')).toEqual({});
  });
});
