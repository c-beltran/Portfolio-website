import { describe, expect, it } from 'vitest';
import { conditionFor } from './conditions';

describe('conditionFor (a WMO weather code to what the window shows)', () => {
  it.each([
    [0, 'clear', 0],
    [1, 'clear', 0.2],
    [2, 'partly', 0.5],
    [3, 'overcast', 1],
    [45, 'fog', 1],
    [48, 'fog', 1],
    [51, 'rain', 0.35],
    [57, 'rain', 0.35],
    [61, 'rain', 0.5],
    [63, 'rain', 0.75],
    [65, 'rain', 1],
    [66, 'rain', 0.75],
    [67, 'rain', 1],
    [80, 'rain', 0.5],
    [81, 'rain', 0.75],
    [82, 'rain', 1],
    [71, 'snow', 0.4],
    [73, 'snow', 0.7],
    [75, 'snow', 1],
    [77, 'snow', 0.3],
    [85, 'snow', 0.4],
    [86, 'snow', 1],
    [95, 'storm', 0.8],
    [96, 'storm', 1],
    [99, 'storm', 1],
  ])('%i → %s at %f', (code, condition, intensity) => {
    expect(conditionFor(code)).toEqual({ condition, intensity });
  });

  it.each([4, 44, 50, 58, 60, 68, 70, 78, 79, 83, 84, 87, 94, 97, 98, 100, -1, 1.5, NaN])(
    'has nothing for %f',
    (code) => expect(conditionFor(code)).toBeNull(),
  );
});
