import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { band, bandCount, bandMedia, master, PORTRAIT, portraitStrip } from './framing';
import { framingCss } from './framingCss';

const css = framingCss();

/** The declarations inside the block that follows `head` (a selector or an @media prelude). */
function block(head: string): string {
  const i = css.indexOf(head);
  if (i < 0) throw new Error(`no block for ${head}`);
  let depth = 0;
  let start = -1;
  for (let j = css.indexOf('{', i); j < css.length; j++) {
    if (css[j] === '{' && depth++ === 0) start = j + 1;
    if (css[j] === '}' && --depth === 0) return css.slice(start, j);
  }
  throw new Error(`unclosed block for ${head}`);
}

const value = (decls: string, name: string) => {
  const m = decls.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no ${name} in ${decls}`);
  return m[1]!.trim();
};

describe('framingCss', () => {
  it('sets the master size and the scale on .desk-still', () => {
    const base = block('.desk-still {');
    expect(parseFloat(value(base, '--mw'))).toBeCloseTo(master().w, 4);
    expect(parseFloat(value(base, '--mh'))).toBeCloseTo(master().h, 4);
    expect(value(base, '--u')).toBe(
      'max(min(100cqw / 1.6, 100cqh), 100cqw / 3.5556, 100cqh / 1.3333)',
    );
  });

  it('has one rule per wide band above the first, with exactly the queries from bandMedia()', () => {
    for (let i = 1; i < bandCount(); i++) expect(css).toContain(`@media ${bandMedia(i)} {`);
    expect(css.match(/@media \(min-aspect-ratio/g)).toHaveLength(bandCount() - 1);
  });

  it('places each band crop in master percents (band 0 is the default)', () => {
    const pct = (n: number) => parseFloat((n * 100).toFixed(4));
    const check = (decls: string, r: ReturnType<typeof band>) => {
      expect(parseFloat(value(decls, '--bx0'))).toBeCloseTo(pct(r.x0), 3);
      expect(parseFloat(value(decls, '--by0'))).toBeCloseTo(pct(r.y0), 3);
      expect(parseFloat(value(decls, '--bw'))).toBeCloseTo(pct(r.x1 - r.x0), 3);
      expect(parseFloat(value(decls, '--bh'))).toBeCloseTo(pct(r.y1 - r.y0), 3);
    };
    check(block('.desk-still {'), band(0));
    for (let i = 1; i < bandCount(); i++) check(block(`@media ${bandMedia(i)} {`), band(i));
    check(block(`@media ${PORTRAIT} {`), portraitStrip());
  });

  it('portrait windows scale by height and scroll across the safe frame', () => {
    const p = block(`@media ${PORTRAIT} {`);
    expect(value(p, '--u')).toBe('100cqh');
    expect(value(p, '--stage-w')).toBe('calc(1.6 * 100cqh)');
    expect(p).toContain('overflow-x: auto');
  });

  it('puts the portrait block last, so it wins over the default band', () => {
    expect(css.lastIndexOf('@media')).toBe(css.indexOf(`@media ${PORTRAIT}`));
  });

  it("globals.css's portrait panel sheet uses the same query", () => {
    expect(readFileSync('app/globals.css', 'utf8')).toContain(`@media ${PORTRAIT} {`);
  });
});
