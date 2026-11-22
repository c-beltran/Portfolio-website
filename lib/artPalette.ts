/**
 * Fixed colours of the placeholder desk art. Objects keep their own colours in both themes;
 * lamp mode dims them with one multiply overlay (TOKENS.dusk). Every pair used for text is listed
 * in ART_TEXT_PAIRS and contrast-tested under that dim (lib/artPalette.test.ts).
 */
export const ART_PALETTE = {
  ink: '#15191C',
  inkMuted: '#2A3036',
  paper: '#FFFFFF',
  photo: '#D5D9DD',
  bar: '#15191C',
  barInk: '#F3F4F5',
  note: '#FFE27A',
  noteInk: '#2B2410',
} as const;

export type ArtColor = keyof typeof ART_PALETTE;

export const ART_TEXT_PAIRS: [fg: ArtColor, bg: ArtColor][] = [
  ['ink', 'paper'],
  ['inkMuted', 'paper'],
  ['paper', 'bar'],
  ['barInk', 'bar'],
  ['ink', 'photo'],
  ['noteInk', 'note'],
];

/** CSS mix-blend-mode: multiply of two opaque colours. */
export function multiply(a: string, b: string): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return (
    '#' +
    [1, 3, 5]
      .map((i) => Math.round((ch(a, i) * ch(b, i)) / 255))
      .map((v) => v.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}
