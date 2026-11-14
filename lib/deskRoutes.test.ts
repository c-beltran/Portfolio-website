import { describe, expect, it } from 'vitest';
import { slugFromPath, titleFor } from './deskRoutes';

describe('slugFromPath', () => {
  it('maps section routes, with or without a trailing slash', () => {
    expect(slugFromPath('/potaflow')).toBe('potaflow');
    expect(slugFromPath('/potaflow/')).toBe('potaflow');
  });

  it('returns null for the overview and unknown paths', () => {
    expect(slugFromPath('/')).toBeNull();
    expect(slugFromPath('/nope')).toBeNull();
    expect(slugFromPath('/classic')).toBeNull();
  });
});

describe('titleFor', () => {
  it('titles the overview and each section', () => {
    expect(titleFor(null)).toBe('Carlos Beltran · Senior Software Engineer');
    expect(titleFor('power-walk')).toBe('Power Walk · Carlos Beltran');
  });
});

describe('vercel.json', () => {
  it('serves extensionless OG images as image/png', async () => {
    const { readFileSync } = await import('node:fs');
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const rule = config.headers.find((h) => h.source.includes('opengraph-image'));
    expect(rule?.headers).toContainEqual({ key: 'Content-Type', value: 'image/png' });
  });
});
