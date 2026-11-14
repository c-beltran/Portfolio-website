import { describe, expect, it } from 'vitest';
import { headerSummary, LINKS, showResume } from './links';

describe('showResume', () => {
  it('shows the résumé only outside production and only when the PDF exists', () => {
    expect(showResume('production', true)).toBe(false);
    expect(showResume('preview', true)).toBe(true);
    expect(showResume(undefined, true)).toBe(true);
    expect(showResume('preview', false)).toBe(false);
  });
});

describe('headerSummary', () => {
  it('derives the years and never names the employer', () => {
    const s = headerSummary(new Date('2026-11-13'));
    expect(s.startsWith('Senior Software Engineer. 7 years at the same company')).toBe(true);
    expect(s).not.toContain('People Inc');
    expect(s).not.toContain('same ad platform');
  });
});

describe('LINKS', () => {
  it('has no email address', () => {
    expect(JSON.stringify(LINKS)).not.toContain('@');
  });
});
