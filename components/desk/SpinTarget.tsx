'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { artOf } from '@/content/opened';
import { spinLive } from '@/lib/spin/live';
import { createSpin, type Spin, type SpinId } from '@/lib/spin/spin';
import { reducedMotion } from '@/lib/weather/hold';

const NAMES: Record<SpinId, string> = { car: 'car', ball: 'ball', mug: 'mug' };
/** Velocity of a release: the pointer's motion over the last stretch of the drag. */
const FLICK_MS = 80;

/**
 * What the visitor grabs to spin an object that has come forward: a button over its art (outside
 * the art's aria-hidden layer, in a layer of its own laid out the same), taking drags, flicks and
 * the arrow keys. It steps the spin while it moves; the views draw it (spinLive). On close the
 * spin eases home.
 */
export function SpinTarget({
  id,
  side,
  leaving,
  onFirstInput,
}: {
  id: SpinId;
  side: 'left' | 'right';
  leaving?: boolean;
  onFirstInput?: () => void;
}) {
  const spin = useRef<Spin | null>(null);
  const raf = useRef(0);
  const touched = useRef(false);
  const el = useRef<HTMLButtonElement>(null);

  const run = () => {
    if (raf.current) return;
    let prev = performance.now();
    const tick = (now: number) => {
      const s = spin.current;
      const moving = !!s && s.step(Math.min(now - prev, 50));
      prev = now;
      el.current?.setAttribute('data-spin', moving ? 'moving' : 'rest');
      spinLive.moved();
      raf.current = moving ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };

  const first = () => {
    if (touched.current) return;
    touched.current = true;
    onFirstInput?.();
  };

  useEffect(() => {
    const s = createSpin({ reducedMotion: reducedMotion() });
    spin.current = s;
    spinLive.set({ id, spin: s });
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      if (spinLive.get()?.spin === s) spinLive.set(null);
    };
  }, [id]);

  useEffect(() => {
    if (!leaving || !spin.current) return;
    spin.current.reset();
    spinLive.moved();
    run();
  }, [leaving]);

  const trail = useRef<{ x: number; y: number; t: number }[]>([]);
  const down = useRef(false);

  return (
    <div className="spin-layer" data-side={side} data-leaving={leaving || undefined}>
      <div className="opened__slot">
        <button
          ref={el}
          type="button"
          className="opened__art spin-target"
          style={{ '--aspect': artOf(id).aspect } as CSSProperties}
          aria-label={`Spin the ${NAMES[id]}: drag, or use the arrow keys`}
          data-spin="rest"
          data-spin-for={id}
          onPointerDown={(e) => {
            if (!spin.current) return;
            first();
            down.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            trail.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
            spin.current.drag(0, 0);
          }}
          onPointerMove={(e) => {
            if (!down.current || !spin.current) return;
            const last = trail.current[trail.current.length - 1]!;
            spin.current.drag(e.clientX - last.x, e.clientY - last.y);
            trail.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
            trail.current = trail.current.filter((p) => e.timeStamp - p.t <= FLICK_MS);
            el.current?.setAttribute('data-spin', 'moving');
            spinLive.moved();
          }}
          onPointerUp={(e) => {
            if (!down.current || !spin.current) return;
            down.current = false;
            const t = trail.current.filter((p) => e.timeStamp - p.t <= FLICK_MS);
            const a = t[0];
            const dt = a ? e.timeStamp - a.t : 0;
            if (a && dt > 0) spin.current.release((e.clientX - a.x) / dt, (e.clientY - a.y) / dt);
            run();
          }}
          onPointerCancel={() => {
            down.current = false;
            run();
          }}
          onKeyDown={(e) => {
            const s = spin.current;
            if (!s) return;
            const step = e.shiftKey ? 45 : 15;
            const keys: Record<string, () => void> = {
              ArrowLeft: () => s.nudge('y', -step),
              ArrowRight: () => s.nudge('y', step),
              ArrowUp: () => s.nudge('x', -step),
              ArrowDown: () => s.nudge('x', step),
              Home: () => s.reset(),
              '0': () => s.reset(),
            };
            const act = keys[e.key];
            if (!act) return;
            e.preventDefault();
            first();
            act();
            spinLive.moved();
            run();
          }}
        />
      </div>
    </div>
  );
}
