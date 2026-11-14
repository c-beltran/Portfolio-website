import { describe, expect, it } from 'vitest';
import { headerSummary, LINKS, showResume } from './links';

describe('showResume', () => {
  it('hides the résumé only in production builds', () => {
    expect(showResume('production')).toBe(false);
    expect(showResume('preview')).toBe(true);
    expect(showResume(undefined)).toBe(true);
  });
});

describe('headerSummary', () => {
  it('derives the years and never names the employer', () => {
    const s = headerSummary(new Date('2026-11-13'));
    expect(s.startsWith('Senior Software Engineer. 7 years')).toBe(true);
    expect(s).not.toContain('People Inc');
  });
});

describe('LINKS', () => {
  it('has no email address', () => {
    expect(JSON.stringify(LINKS)).not.toContain('@');
  });
});
