import { describe, expect, it } from 'vitest';
import { contrastRatio, TEXT_PAIRS, THEME_SCRIPT, themeCss, TOKENS, type ThemeName } from './theme';

describe('tokens', () => {
  it.each(['day', 'lamp'] as ThemeName[])('every text pair in %s meets 4.5:1', (theme) => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrastRatio(TOKENS[theme][fg], TOKENS[theme][bg]);
      expect(ratio, `${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
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
