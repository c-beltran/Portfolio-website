import { describe, expect, it, vi } from 'vitest';
import { spinLive } from './live';
import { createSpin } from './spin';

describe('the live spin', () => {
  it('tells its readers when the spin moves or changes hands', () => {
    const f = vi.fn();
    const off = spinLive.subscribe(f);
    const spin = createSpin({ reducedMotion: false });
    spinLive.set({ id: 'car', spin });
    expect(spinLive.get()?.id).toBe('car');
    spinLive.moved();
    spinLive.set(null);
    expect(f).toHaveBeenCalledTimes(3);
    off();
    spinLive.moved();
    expect(f).toHaveBeenCalledTimes(3);
  });
});
