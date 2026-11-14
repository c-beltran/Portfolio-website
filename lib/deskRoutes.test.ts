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
