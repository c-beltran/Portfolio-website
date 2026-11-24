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
  // The desk. Decorative, except stickerInk on sticker, which is text.
  | 'wood'
  | 'felt'
  | 'feltLine'
  | 'sticker'
  | 'stickerInk'
  | 'lampGlow'
  // Lamp mode's light: the room multiplies by dusk, except a pool of light under the lamp.
  | 'dusk'
  | 'pool'
  | 'scrawl'
  // The monitor's right half: the rendered paper page under the HTML name, sampled from the
  // seat stills (the paper is light in both modes, so the ink is dark in both).
  | 'screenPaper'
  | 'screenInk';

/** The day and lamp palettes. */
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
    scrawl: '#FFE9A8',
    screenPaper: '#ABABA9',
    screenInk: '#15191C',
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
    dusk: '#90939A',
    pool: '#FFE0A8',
    scrawl: '#FFE9A8',
    screenPaper: '#D4D3D2',
    screenInk: '#15191C',
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
  ['screenInk', 'screenPaper'],
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

/** The monitor's paper belongs to the render on show (data-theme), not to the page palette. */
const paper = (theme: ThemeName) =>
  `--screen-paper:${TOKENS[theme].screenPaper};--screen-ink:${TOKENS[theme].screenInk}`;

/**
 * Theme variables, generated from TOKENS so the CSS can never drift from the tested values. The
 * palette follows the time of day (data-time); the monitor's paper follows the render.
 */
export function themeCss(): string {
  return [
    `:root,:root[data-time="day"]{${vars('day')};color-scheme:light}`,
    `:root[data-time="night"]{${vars('lamp')};color-scheme:dark}`,
    `:root[data-theme="day"]{${paper('day')}}`,
    `:root[data-theme="lamp"]{${paper('lamp')}}`,
  ].join('\n');
}
