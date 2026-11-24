import { describe, expect, it } from 'vitest';
import { contrastRatio, TEXT_PAIRS, THEME_SCRIPT, themeCss, TOKENS, type ThemeName } from './theme';

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

  it('emits every token as a CSS variable for both themes, with a no-JS dark fallback', () => {
    const css = themeCss();
    expect(css).toContain(':root[data-theme="day"]');
    expect(css).toContain(':root[data-theme="lamp"]');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(`--ink:${TOKENS.lamp.ink}`);
    expect(css).toContain(`--link-hover:${TOKENS.day.linkHover}`);
  });
});

describe('THEME_SCRIPT', () => {
  function runScript(opts: { stored?: string; throws?: boolean; dark: boolean }) {
    const documentElement = { dataset: {} as Record<string, string> };
    const localStorage = {
      getItem: () => {
        if (opts.throws) throw new Error('blocked');
        return opts.stored ?? null;
      },
    };
    const matchMedia = () => ({ matches: opts.dark });
    new Function('localStorage', 'matchMedia', 'document', THEME_SCRIPT)(localStorage, matchMedia, {
      documentElement,
    });
    return documentElement.dataset.theme;
  }

  it('follows the OS when storage throws', () => {
    expect(runScript({ throws: true, dark: true })).toBe('lamp');
    expect(runScript({ throws: true, dark: false })).toBe('day');
  });

  it('prefers a stored choice and ignores junk values', () => {
    expect(runScript({ stored: 'day', dark: true })).toBe('day');
    expect(runScript({ stored: 'purple', dark: true })).toBe('lamp');
  });
});

describe('the name on the monitor', () => {
  it('is dark ink on the rendered screen paper, at 4.5:1 or better in both themes', () => {
    expect(TEXT_PAIRS).toContainEqual(['screenInk', 'screenPaper']);
    for (const t of ['day', 'lamp'] as const)
      expect(contrastRatio(TOKENS[t].screenInk, TOKENS[t].screenPaper)).toBeGreaterThanOrEqual(4.5);
  });
});
