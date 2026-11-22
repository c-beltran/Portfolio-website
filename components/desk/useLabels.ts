import { useEffect, useRef, type RefObject } from 'react';
import type { SectionSlug } from '@/content/objects';
import { HINT_END, hintShowing } from './hint';
import { nearby } from './nearby';

/**
 * Labels appear where you look, on the desk layer:
 * - mouse and pen: the label of the object nearest the pointer (data-near on its hotspot), within
 *   max(90px, 12% of the window's shorter side), checked once per animation frame;
 * - touch (hover: none): every label for 2 s on arrival, or as the turn-sideways hint ends, and
 *   again after 8 s without a touch, until the visitor first opens something (data-intro);
 * - keyboard: focusing a section in the Sections list shows its label (CSS, labelFocusCss) and, in
 *   a portrait window, scrolls the desk to the object.
 */
export function useLabels(layer: RefObject<HTMLDivElement | null>, selected: SectionSlug | null) {
  const opened = useRef(selected !== null);
  useEffect(() => {
    if (selected) opened.current = true;
  }, [selected]);

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const still = el.closest<HTMLElement>('.desk-still')!;
    let frame = 0;
    let at: [number, number] | null = null;
    let near: HTMLElement | null = null;
    const show = (h: HTMLElement | null) => {
      if (h === near) return;
      near?.removeAttribute('data-near');
      h?.setAttribute('data-near', 'true');
      near = h;
    };
    const update = () => {
      frame = 0;
      if (!at) return show(null);
      const spots = [...el.querySelectorAll<HTMLElement>('button.hotspot')];
      const centres = Object.fromEntries(
        spots.map((s) => {
          const b = s.getBoundingClientRect();
          return [s.dataset.item!, [b.x + b.width / 2, b.y + b.height / 2] as [number, number]];
        }),
      );
      const radius = Math.max(90, 0.12 * Math.min(still.clientWidth, still.clientHeight));
      const key = nearby(centres, at, radius);
      show(key ? (spots.find((s) => s.dataset.item === key) ?? null) : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      // Only over the desk itself: not the panel, the Sections card or the hint.
      at = (e.target as Element | null)?.closest?.('.desk-still') ? [e.clientX, e.clientY] : null;
      schedule();
    };
    const onLeave = () => {
      at = null;
      schedule();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      show(null);
    };
  }, [layer]);

  useEffect(() => {
    const el = layer.current;
    if (!el || !matchMedia('(hover: none)').matches) return;
    let introT = 0;
    let idleT = 0;
    const arm = () => {
      window.clearTimeout(idleT);
      if (!opened.current) idleT = window.setTimeout(intro, 8000);
    };
    const intro = () => {
      el.dataset.intro = 'true';
      window.clearTimeout(introT);
      introT = window.setTimeout(() => {
        delete el.dataset.intro;
        arm();
      }, 2000);
    };
    const onDown = () => {
      if (!el.dataset.intro) arm();
    };
    window.addEventListener('pointerdown', onDown, { passive: true });
    if (hintShowing()) window.addEventListener(HINT_END, intro, { once: true });
    else intro();
    return () => {
      window.clearTimeout(introT);
      window.clearTimeout(idleT);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener(HINT_END, intro);
      delete el.dataset.intro;
    };
  }, [layer]);

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const still = el.closest<HTMLElement>('.desk-still')!;
    const onFocus = (e: FocusEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>('.drawer__button');
      if (!b || still.scrollWidth <= still.clientWidth) return;
      const sel = b.dataset.slug
        ? `.hotspot[data-slug="${b.dataset.slug}"]`
        : '.hotspot[data-item="lightbar"]';
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.querySelector(sel)?.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: reduce ? 'auto' : 'smooth',
      });
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, [layer]);
}
