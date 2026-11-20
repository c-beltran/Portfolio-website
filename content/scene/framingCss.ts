/**
 * The seat framing as CSS (design 2026-11-19 §3.2): custom properties on .desk-still that
 * globals.css uses to place the master, the band crop and the hotspots, with no script reading the
 * viewport. Same maths as framing.ts:
 *
 * - --u: pixels per safe height. Wide windows contain the safe frame but always cover the master's
 *   width or height (framing.ts wide()); portrait windows (PORTRAIT) are one safe height tall.
 * - --stage-w: the stage is the window, or in portrait the safe frame's width, which .desk-still
 *   scrolls across.
 * - --bx0 --by0 --bw --bh: the crop of the master the current window's still covers (percent of
 *   the master), per wide band and for the portrait strip.
 *
 * cq units resolve where the properties are used: inside .desk-still, the size container.
 */
import data from './framing.json' with { type: 'json' };
import {
  band,
  bandCount,
  bandMedia,
  master,
  PORTRAIT,
  portraitStrip,
  ratio,
  type Rect,
} from './framing';

const n = (x: number) => String(Number(x.toFixed(4)));

const crop = (r: Rect) =>
  `--bx0: ${n(r.x0 * 100)}; --by0: ${n(r.y0 * 100)}; --bw: ${n((r.x1 - r.x0) * 100)}; --bh: ${n((r.y1 - r.y0) * 100)};`;

export function framingCss(): string {
  const { w, h } = master();
  const s = n(ratio(data.safeAspect));
  const rules = [
    `.desk-still { --s: ${s}; --mw: ${n(w)}; --mh: ${n(h)}; ` +
      `--u: max(min(100cqw / ${s}, 100cqh), 100cqw / ${n(w)}, 100cqh / ${n(h)}); ` +
      `--stage-w: 100cqw; ${crop(band(0))} }`,
  ];
  for (let i = 1; i < bandCount(); i++)
    rules.push(`@media ${bandMedia(i)} { .desk-still { ${crop(band(i))} } }`);
  rules.push(
    // :root raises it over globals.css's `.desk-still { overflow: hidden }`, wherever each loads.
    `@media ${PORTRAIT} { :root .desk-still { --u: 100cqh; --stage-w: calc(${s} * 100cqh); ` +
      `overflow-x: auto; ${crop(portraitStrip())} } }`,
  );
  // The loaded image keeps its own crop until the new one arrives (DeskStill sets data-crop on
  // load), so a rotation or resize never stretches the old still into the new crop's box.
  for (let i = 0; i < bandCount(); i++)
    rules.push(`.desk-still__photo img[data-crop='b${i}'] { ${crop(band(i))} }`);
  rules.push(`.desk-still__photo img[data-crop='p'] { ${crop(portraitStrip())} }`);
  return rules.join('\n');
}

/**
 * The `sizes` of a crop of `widthInSafeHeights`: its displayed width, from the same --u maths in
 * viewport units (the desk fills the viewport).
 */
export function sizesFor(widthInSafeHeights: number, portrait = false): string {
  const { w, h } = master();
  const s = ratio(data.safeAspect);
  const u = portrait
    ? '100vh'
    : `max(min(${n(100 / s)}vw, 100vh), ${n(100 / w)}vw, ${n(100 / h)}vh)`;
  return `calc(${n(widthInSafeHeights)} * ${u})`;
}
