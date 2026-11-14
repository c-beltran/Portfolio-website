'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import type { SectionSlug } from '@/content/objects';
import { slugFromPath, titleFor } from './deskRoutes';

export { slugFromPath, titleFor };

const drawerButton = (slug: SectionSlug) =>
  document.querySelector<HTMLElement>(`nav[aria-label="Sections"] [data-slug="${slug}"]`);

const focusIsLost = () => {
  const el = document.activeElement;
  return !el || el === document.body || !!el.closest('section.panel');
};

/** On close, focus returns to the section's trigger unless the visitor has moved off the desk. */
const focusBelongsToDesk = () =>
  focusIsLost() || !!document.activeElement?.closest('nav[aria-label="Sections"]');

/**
 * The desk's selection IS the URL. Next 16 keeps usePathname in sync with raw
 * history.pushState and popstate (verified in the M0 spike), including when Next restores a
 * saved router tree on Back from another route, so the selection can never disagree with the URL.
 */
export function useDeskState() {
  const selected = slugFromPath(usePathname() ?? '/');
  const previous = useRef<SectionSlug | null>(selected);
  const focusPanel = useRef(false);
  /** The selection Next has committed; the URL can run ahead of it while a navigation is pending. */
  const committed = useRef<SectionSlug | null>(selected);
  const queued = useRef<(() => void) | null>(null);

  useEffect(() => {
    committed.current = selected;
    document.title = titleFor(selected);
    const was = previous.current;
    previous.current = selected;
    const userOpened = focusPanel.current;
    focusPanel.current = false;
    if (selected && (userOpened || (was !== selected && focusIsLost()))) {
      // Opened by the visitor, or Back/Forward swapped panels under the focus: focus the new panel.
      document.getElementById('panel-title')?.focus();
    } else if (!selected && was && focusBelongsToDesk()) {
      // Closed (Esc, Back to desk, browser Back): focus returns to the section that was open.
      drawerButton(was)?.focus();
    }
    const next = queued.current;
    queued.current = null;
    // Effects run child-first, so Next's own history effect (in a parent) still has to run for
    // this commit; the queued navigation goes after it, on the next tick.
    if (next) setTimeout(next, 0);
  }, [selected]);

  /**
   * Next commits a raw pushState in a transition and then rewrites the URL to the state it
   * committed, so a second navigation issued before that commit would be undone (open, then Esc
   * within the same moment, ended back on the section). Until Next catches up, the latest
   * navigation waits and runs right after the commit.
   */
  const navigate = useCallback((run: () => void) => {
    if (slugFromPath(window.location.pathname) !== committed.current) queued.current = run;
    else run();
  }, []);

  const open = useCallback(
    (slug: SectionSlug) =>
      navigate(() => {
        if (slugFromPath(window.location.pathname) === slug) return;
        focusPanel.current = true;
        window.history.pushState(null, '', `/${slug}`);
      }),
    [navigate],
  );

  const close = useCallback(
    () =>
      navigate(() => {
        if (slugFromPath(window.location.pathname) === null) return;
        window.history.pushState(null, '', '/');
      }),
    [navigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      close();
    };
    document.addEventListener('keydown', onKey);
    // Hydration marker: tests wait for it before pressing keys on a freshly loaded page.
    document.documentElement.dataset.deskReady = 'true';
    return () => {
      document.removeEventListener('keydown', onKey);
      delete document.documentElement.dataset.deskReady;
    };
  }, [close]);

  return { selected, open, close };
}
