'use client';

import { useTheme } from '@/lib/useTheme';

/** The DOM mirror of the desk lamp: toggles day/lamp and remembers the choice if storage allows. */
export function LampToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="lamp-toggle" aria-pressed={theme === 'lamp'} onClick={toggle}>
      Lamp
    </button>
  );
}
