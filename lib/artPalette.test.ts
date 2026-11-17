import { describe, expect, it } from 'vitest';
import { ART_PALETTE, ART_TEXT_PAIRS, multiply } from './artPalette';
import { contrastRatio, TOKENS, type ThemeName } from './theme';

describe('multiply', () => {
  it('blends like CSS mix-blend-mode: multiply', () => {
    expect(multiply('#FFFFFF', '#4E535C')).toBe('#4E535C');
    expect(multiply('#808080', '#808080')).toBe('#404040');
  });
});

/**
 * Text drawn on the desk is aria-hidden SVG, which axe can't measure. This is its contrast
 * check: every pair, in day, and under lamp mode's dusk multiply (the darkest the desk gets).
 */
describe.each(['day', 'lamp'] as ThemeName[])('desk text in %s', (theme) => {
  const dusk = TOKENS[theme].dusk;
  const pairs: [string, string, string][] = [
    ...ART_TEXT_PAIRS.map(
      ([fg, bg]) => [`${fg}/${bg}`, ART_PALETTE[fg], ART_PALETTE[bg]] as [string, string, string],
    ),
    ['stickerInk/sticker', TOKENS[theme].stickerInk, TOKENS[theme].sticker],
    ['scrawl/felt', TOKENS[theme].scrawl, TOKENS[theme].felt],
  ];

  it.each(pairs)('%s meets 4.5:1 under the lamp-mode dim', (_, fg, bg) => {
    expect(contrastRatio(multiply(fg, dusk), multiply(bg, dusk))).toBeGreaterThanOrEqual(4.5);
  });
});
