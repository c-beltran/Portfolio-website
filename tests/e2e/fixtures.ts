import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * Today at a given hour in New York. Only the hour is pinned: the date stays today's, so text the
 * build dated (years since a start date) matches the page.
 */
export function todayInNewYork(hour: number): Date {
  const now = new Date();
  const part = (type: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...o })
      .formatToParts(now)
      .find((p) => p.type === type)!.value;
  const ymd = `${part('year', { year: 'numeric' })}-${part('month', { month: '2-digit' })}-${part('day', { day: '2-digit' })}`;
  const offset =
    part('timeZoneName', { timeZoneName: 'longOffset' }).replace('GMT', '') || '+00:00';
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00${offset}`);
}

/** Noon in New York: daytime, so the lamp starts off (desk.ts `atNight` moves it). */
export const NOON = todayInNewYork(12);

/** What the weather service answers unless a test routes it itself: a clear sky. */
export const CLEAR_SKY = {
  current: { weather_code: 0, cloud_cover: 0, wind_speed_10m: 1, wind_direction_10m: 270 },
};

/**
 * The specs' test:
 * - the turn-sideways hint counts as already seen, so it never covers what a test taps (hint.spec,
 *   and the labels test that needs the hint, use @playwright/test's own test instead);
 * - the clock and time zone are pinned, so day or night never depends on when the suite runs;
 * - the weather service is never called: it answers a clear sky.
 */
export const test = base.extend<{ hintSeen: void; pinned: void }>({
  timezoneId: 'America/New_York',
  hintSeen: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem('desk-hint-seen', '1');
        } catch {}
      });
      await use();
    },
    { auto: true },
  ],
  pinned: [
    async ({ context }, use) => {
      await context.clock.setFixedTime(NOON);
      await context.route('https://api.open-meteo.com/**', (route) =>
        route.fulfill({ json: CLEAR_SKY }),
      );
      await use();
    },
    { auto: true },
  ],
});
