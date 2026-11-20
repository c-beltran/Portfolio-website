import type { CSSProperties } from 'react';
import seat from '@/content/scene/bounds-seat.json';
import { master } from '@/content/scene/framing';
import { NAME_REGION, screenAffine, type Pt } from '@/content/scene/screenAffine';

const FIT = screenAffine(seat.quads.screen_right as Pt[], master(), NAME_REGION);
const n = (x: number) => Number(x.toFixed(5));

/**
 * Carlos's name and title on the monitor's right half (design 2026-11-19 §4.2): the page's h1, real
 * HTML laid onto the rendered paper page. It sits on the master like the hotspots (globals.css,
 * .desk-still__overlay), outside the aria-hidden desk, and is never a pointer target: the CV
 * hotspot under it takes the click.
 */
export function MonitorName() {
  const [a, b, c, d] = FIT.matrix.map(n);
  const style = {
    '--nx': n(FIT.x),
    '--ny': n(FIT.y),
    '--nw': n(FIT.w),
    '--nh': n(FIT.h),
    '--nm': `${a}, ${b}, ${c}, ${d}`,
  } as CSSProperties;
  return (
    <div className="monitor-name" style={style}>
      <h1 className="monitor-name__name">Carlos Beltran</h1>
      <p className="monitor-name__title">Senior Software Engineer</p>
    </div>
  );
}
