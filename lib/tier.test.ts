import { describe, expect, it } from 'vitest';
import { forcedTier } from './tier';

describe('forcedTier', () => {
  it('forces the live scene with ?tier=2', () => {
    expect(forcedTier('?tier=2')).toBe(2);
    expect(forcedTier('?utm_source=x&tier=2')).toBe(2);
  });

  it.each(['', '?tier=1', '?tier=2x', '?tier=', '?xtier=2'])('ignores %j', (search) => {
    expect(forcedTier(search)).toBeNull();
  });
});
