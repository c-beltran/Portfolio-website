'use client';

import { useLight } from '@/lib/useLight';

/** The DOM mirror of the desk lamp: toggles day/lamp and remembers the choice if storage allows. */
export function LampToggle() {
  const { lamp, toggleLamp } = useLight();
  return (
    <button type="button" className="lamp-toggle" aria-pressed={lamp === 'on'} onClick={toggleLamp}>
      Lamp
    </button>
  );
}
