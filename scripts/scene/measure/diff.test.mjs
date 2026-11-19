import { describe, expect, it } from 'vitest';
import { diff } from './diff.mjs';

const rgb = (n, v) => Buffer.alloc(n * 3, v);

describe('diff', () => {
  it('is zero for identical images', () => {
    expect(diff(rgb(4, 100), rgb(4, 100))).toEqual({ meanAbs: 0, over40: 0 });
  });

  it('counts every channel off by more than 40', () => {
    expect(diff(rgb(4, 100), rgb(4, 150))).toEqual({ meanAbs: 50, over40: 1 });
  });

  it('does not count channels off by 40 or less', () => {
    expect(diff(rgb(4, 100), rgb(4, 70))).toEqual({ meanAbs: 30, over40: 0 });
  });

  it('refuses images of different sizes', () => {
    expect(() => diff(rgb(4, 0), rgb(5, 0))).toThrow(/size/);
  });
});
