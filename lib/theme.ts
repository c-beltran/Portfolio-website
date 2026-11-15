export type ThemeName = 'day' | 'lamp';
export type TokenName =
  | 'bg'
  | 'surface'
  | 'ink'
  | 'inkMuted'
  | 'inkSoft'
  | 'border'
  | 'link'
  | 'linkHover'
  | 'focus'
  | 'accent'
  // The desk (M2). Decorative, except stickerInk on sticker, which is text.
  | 'wood'
  | 'felt'
  | 'feltLine'
  | 'sticker'
  | 'stickerInk'
  | 'lampGlow'
  // Lamp mode's light: the room multiplies by dusk, except a pool of light under the lamp.
  | 'dusk'
  | 'pool';

export const THEME_STORAGE_KEY = 'desk-theme';

/** Day is from the mock; lamp is ours (Q17: the mock is not the art target). */
export const TOKENS: Record<ThemeName, Record<TokenName, string>> = {
  day: {
    bg: '#EEF0EC',
    surface: '#FFFFFF',
    ink: '#15191C',
    inkMuted: '#3E454B',
    inkSoft: '#2A3036',
    border: '#8A9096',
    link: '#15191C',
    linkHover: '#9A2E18',
    focus: '#9A2E18',
    accent: '#FFD84D',
    wood: '#B98A57',
    felt: '#2E5A4E',
    feltLine: '#3A6B5D',
    sticker: '#FFF8E6',
    stickerInk: '#15191C',
    lampGlow: '#8A8072',
    dusk: '#FFFFFF',
    pool: '#FFFFFF',
  },
  lamp: {
    bg: '#14110D',
    surface: '#1F1A14',
    ink: '#F3EBDD',
    inkMuted: '#C9BBA5',
    inkSoft: '#E2D6C3',
    border: '#6B5E4C',
    link: '#F3EBDD',
    linkHover: '#FFC46B',
    focus: '#FFD84D',
    accent: '#FFB454',
    wood: '#4A3524',
    felt: '#17302A',
    feltLine: '#1F3D35',
    sticker: '#E9DFC9',
    stickerInk: '#15191C',
    lampGlow: '#FFE9A8',
    dusk: '#4E535C',
    pool: '#FFE0A8',
  },
};

/** Every foreground/background pair used for text. Each must meet 4.5:1 in both themes. */
export const TEXT_PAIRS: [fg: TokenName, bg: TokenName][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['inkMuted', 'bg'],
  ['inkMuted', 'surface'],
  ['inkSoft', 'bg'],
  ['inkSoft', 'surface'],
  ['link', 'bg'],
  ['link', 'surface'],
  ['linkHover', 'bg'],
  ['linkHover', 'surface'],
  ['stickerInk', 'sticker'],
];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio. */
export function contrastRatio(hexA: string, hexB: string): number {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const cssName = (token: string) => `--${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const vars = (theme: ThemeName) =>
  Object.entries(TOKENS[theme])
    .map(([k, v]) => `${cssName(k)}:${v}`)
    .join(';');

/** Theme variables, generated from TOKENS so the CSS can never drift from the tested values. */
export function themeCss(): string {
  return [
    `:root,:root[data-theme="day"]{${vars('day')};color-scheme:light}`,
    `:root[data-theme="lamp"]{${vars('lamp')};color-scheme:dark}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme]){${vars('lamp')};color-scheme:dark}}`,
  ].join('\n');
}

/** Runs inline in <head> before first paint: stored choice, else the OS setting. Never throws. */
export const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='day'&&t!=='lamp'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'lamp':'day'}catch(e){t='day'}}document.documentElement.dataset.theme=t})();`;
