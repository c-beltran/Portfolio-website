'use client';

import { useEffect, useRef, useState } from 'react';
import { buildScreen } from '@/content/faces';

/**
 * The left half, leaned in to: a spec, its merged PR, the CI checks and a session replay. After a
 * visitor's open, the checks turn green and the replay rows appear (globals.css), starting the
 * first time the face is actually visible. A direct load, and reduced motion, show it finished.
 */
export function BuildScreen() {
  const b = buildScreen();
  const ref = useRef<HTMLDivElement>(null);
  // 'done' on the server and on a direct load; 'waiting' then 'running' after a visitor's open.
  const [state, setState] = useState<'done' | 'waiting' | 'running'>('done');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    // Desk.tsx marks a visitor's change (data-animate) in its own effect, after this one: look on
    // the next frame, before it paints.
    raf = requestAnimationFrame(() => {
      const fresh = !!el.closest('.desk[data-animate]');
      if (!fresh || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setState('waiting');
      const poll = () => {
        if (el.checkVisibility?.({ visibilityProperty: true }) ?? true) setState('running');
        else raf = requestAnimationFrame(poll);
      };
      raf = requestAnimationFrame(poll);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="face face--build" data-state={state}>
      <p className="face__todo">{b.spec}</p>
      <p className="face__todo">{b.pr}</p>
      <ul className="face__checks">
        {b.checks.map((c, i) => (
          <li key={c} className="face__check" style={{ '--i': i } as React.CSSProperties}>
            {c}
          </li>
        ))}
      </ul>
      <p className="face__todo">{b.checksTodo}</p>
      <p className="face__todo">{b.session}</p>
      <div className="face__replay" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
