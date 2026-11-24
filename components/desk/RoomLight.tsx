'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import {
  lightFor,
  MOON_RGB,
  POOL,
  SCREENS,
  TINT_FAR_SHARE,
  WINDOW_SIDE,
  type Box,
} from '@/content/weather/light';
import { useLight } from '@/lib/useLight';
import type { Sky } from '@/lib/weather/types';

/** A mask over the master (read by luminance): the room, with the screens cut out under soft edges. */
const MASK = (() => {
  const rect = (b: Box) => `M${b.x0} ${b.y0}H${b.x1}V${b.y1}H${b.x0}Z`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">` +
    `<filter id="f" x="-0.1" y="-0.1" width="1.2" height="1.2"><feGaussianBlur stdDeviation="0.003"/></filter>` +
    `<rect width="1" height="1" fill="#fff"/>` +
    `<path filter="url(#f)" fill="#000" d="${SCREENS.map(rect).join('')}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

const noop = () => () => {};
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const STYLE = {
  '--rl-mask': MASK,
  '--moon-rgb': MOON_RGB.join(' '),
  '--pool-rgb': POOL.rgb.join(' '),
  '--pool-at': `${pct(POOL.at[0])} ${pct(POOL.at[1])}`,
  '--pool-r': `${pct(POOL.r[0])} ${pct(POOL.r[1])}`,
  '--side-from': pct(WINDOW_SIDE.from),
  '--side-to': pct(WINDOW_SIDE.to),
  '--far-share': pct(TINT_FAR_SHARE),
} as CSSProperties;

/**
 * The room's light over the still: the weather's tint on daylight (stronger toward the window),
 * moonlight on the day render at night with the lamp off, and the lamp's warm pool by day. Before
 * the page hydrates, CSS gives the moon and the pool from <html>'s light, so the first paint is
 * already right; the weather's tint comes when the weather does, fading in.
 */
export function RoomLight({ sky }: { sky: Sky | null }) {
  const { render, lamp, time } = useLight();
  // false while hydrating (so the first client render matches the server's), true after
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const l = lightFor(sky, render, lamp, time);
  const vars = mounted
    ? ({
        '--tint-rgb': l.tint.rgb.join(' '),
        '--tint-k': l.tint.k,
        '--moon': l.moonK,
        '--pool': l.poolK,
      } as CSSProperties)
    : {};
  return (
    <div
      className="room-light"
      aria-hidden="true"
      style={{ ...STYLE, ...vars }}
      data-tint={l.tint.k.toFixed(2)}
      {...(mounted ? { 'data-moon': l.moonK.toFixed(2), 'data-pool': l.poolK.toFixed(2) } : {})}
    >
      <i className="room-light__tint" />
      <i className="room-light__moon" />
      <i className="room-light__pool" />
    </div>
  );
}
