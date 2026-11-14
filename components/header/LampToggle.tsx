'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, type ThemeName } from '@/lib/theme';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const current = (): ThemeName =>
  document.documentElement.dataset.theme === 'lamp' ? 'lamp' : 'day';

/** The DOM mirror of the desk lamp: toggles day/lamp and remembers the choice if storage allows. */
export function LampToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => 'day' as ThemeName);
  const lamp = theme === 'lamp';

  function toggle() {
    const next: ThemeName = lamp ? 'day' : 'lamp';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }
  }

  return (
    <button type="button" className="lamp-toggle" aria-pressed={lamp} onClick={toggle}>
      Lamp
    </button>
  );
}
