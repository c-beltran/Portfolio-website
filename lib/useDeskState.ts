'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SectionSlug } from '@/content/objects';
import { slugFromPath, titleFor } from './deskRoutes';

export { slugFromPath, titleFor };

/**
 * The desk's selection, kept in sync with the URL by raw history.pushState / popstate
 * (verified against Next 16 + Vercel Analytics in the M0 spike). Routes, not hashes.
 */
export function useDeskState(initial: SectionSlug | null) {
  const [selected, setSelected] = useState<SectionSlug | null>(initial);
  const selectedRef = useRef(selected);
  const trigger = useRef<HTMLElement | null>(null);
  const focusPanel = useRef(false);

  useEffect(() => {
    selectedRef.current = selected;
    if (focusPanel.current) {
      focusPanel.current = false;
      document.getElementById('panel-title')?.focus();
    }
  }, [selected]);

  const open = useCallback((slug: SectionSlug, from?: HTMLElement) => {
    if (selectedRef.current === slug) return;
    trigger.current = from ?? null;
    focusPanel.current = true;
    window.history.pushState(null, '', `/${slug}`);
    document.title = titleFor(slug);
    setSelected(slug);
  }, []);

  const close = useCallback(() => {
    if (selectedRef.current === null) return;
    window.history.pushState(null, '', '/');
    document.title = titleFor(null);
    setSelected(null);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    const onPop = () => {
      const slug = slugFromPath(window.location.pathname);
      document.title = titleFor(slug);
      setSelected(slug);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
    };
  }, [close]);

  return { selected, open, close };
}
