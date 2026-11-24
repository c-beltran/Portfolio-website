import { describe, expect, it } from 'vitest';
import { contrastRatio, TEXT_PAIRS, themeCss, TOKENS, type ThemeName } from './theme';

describe('tokens', () => {
  it.each(['day', 'lamp'] as ThemeName[])('every text pair in %s meets 4.5:1', (theme) => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrastRatio(TOKENS[theme][fg], TOKENS[theme][bg]);
      expect(ratio, `${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['day', 'lamp'] as ThemeName[])('desk sticker labels in %s meet 4.5:1', (theme) => {
    expect(contrastRatio(TOKENS[theme].stickerInk, TOKENS[theme].sticker)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(TEXT_PAIRS).toContainEqual(['stickerInk', 'sticker']);
  });

  it.each(['day', 'lamp'] as ThemeName[])('every %s token is a 7-character hex colour', (theme) => {
    for (const k of ['wood', 'felt', 'feltLine', 'sticker', 'stickerInk', 'lampGlow'] as const) {
      expect(TOKENS[theme][k], k).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('emits the palettes by the time of day, never by the system setting', () => {
    const css = themeCss();
    expect(css).toContain(':root[data-time="day"]');
    expect(css).toContain(`:root[data-time="night"]{--bg:${TOKENS.lamp.bg}`);
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).toContain(`--ink:${TOKENS.lamp.ink}`);
    expect(css).toContain(`--link-hover:${TOKENS.day.linkHover}`);
  });

  it("keeps the monitor's paper with the render on show, not the palette", () => {
    // At night with the lamp off the day render shows under a dark page: its paper is the day one.
    const css = themeCss();
    expect(css).toContain(`:root[data-theme="day"]{--screen-paper:${TOKENS.day.screenPaper}`);
    expect(css).toContain(`:root[data-theme="lamp"]{--screen-paper:${TOKENS.lamp.screenPaper}`);
    expect(css.indexOf(':root[data-theme="day"]')).toBeGreaterThan(
      css.indexOf(':root[data-time="night"]'),
    );
  });
});

describe('the name on the monitor', () => {
  it('is dark ink on the rendered screen paper, at 4.5:1 or better in both themes', () => {
    expect(TEXT_PAIRS).toContainEqual(['screenInk', 'screenPaper']);
    for (const t of ['day', 'lamp'] as const)
      expect(contrastRatio(TOKENS[t].screenInk, TOKENS[t].screenPaper)).toBeGreaterThanOrEqual(4.5);
  });
});
