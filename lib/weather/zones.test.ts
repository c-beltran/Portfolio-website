import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { placeFor } from './zones';

const near = (p: { lat: number; lon: number } | null, lat: number, lon: number) => {
  expect(p).not.toBeNull();
  expect(Math.abs(p!.lat - lat)).toBeLessThan(0.5);
  expect(Math.abs(p!.lon - lon)).toBeLessThan(0.5);
};

describe('placeFor (a time zone to its main city)', () => {
  it('finds canonical zones', () => near(placeFor('America/New_York'), 40.71, -74.01));

  it('finds the legacy names browsers still report', () => {
    near(placeFor('Asia/Calcutta'), 22.53, 88.36);
    near(placeFor('US/Pacific'), 34.05, -118.24);
  });

  it.each(['UTC', 'Etc/GMT+5', 'Nope/Zone', '', undefined])('has no place for %s', (z) => {
    expect(placeFor(z)).toBeNull();
  });

  it('ships a small table', () => {
    const json = readFileSync('content/weather/zones.json');
    expect(gzipSync(json).length).toBeLessThan(10_000);
  });
});
