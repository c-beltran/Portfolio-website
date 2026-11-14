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

  useEffect(() => {
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
  }, [selected]);

  const open = useCallback((slug: SectionSlug) => {
    if (slugFromPath(window.location.pathname) === slug) return;
    focusPanel.current = true;
    window.history.pushState(null, '', `/${slug}`);
  }, []);

  const close = useCallback(() => {
    if (slugFromPath(window.location.pathname) === null) return;
    window.history.pushState(null, '', '/');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    // Hydration marker: tests wait for it before pressing keys on a freshly loaded page.
    document.documentElement.dataset.deskReady = 'true';
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  return { selected, open, close };
}
