'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, type ThemeName } from './theme';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const current = (): ThemeName =>
  document.documentElement.dataset.theme === 'lamp' ? 'lamp' : 'day';

/**
 * The theme lives on <html data-theme> (set before first paint by THEME_SCRIPT). Every lamp
 * control reads it here, so the header button and the desk lamp can never disagree.
 */
export function useTheme(): { theme: ThemeName; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, current, () => 'day' as ThemeName);
  const toggle = useCallback(() => {
    const next: ThemeName = current() === 'lamp' ? 'day' : 'lamp';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }
  }, []);
  return { theme, toggle };
}
