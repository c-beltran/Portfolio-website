import { useEffect } from 'react';
import { DESK_OBJECTS, type SectionSlug } from '@/content/objects';
import { useMotion } from '@/lib/useMotion';
import { useLight } from '@/lib/useLight';
import { prefetchArt } from './Opened';

type Props = {
  selected: SectionSlug | null;
  onOpen: (slug: SectionSlug) => void;
};

/**
 * Every desk object mirrored as a real button, plus the motion pause and the lamp.
 * The keyboard and screen-reader path: out of sight until something in it has focus, then a card
 * at the top left. The hotspots stay out of the tab order.
 */
export function Drawer({ selected, onOpen }: Props) {
  const { lamp, toggleLamp } = useLight();
  const motion = useMotion();

  // The last input: the card shows for keyboard focus only (globals.css, the Sections list).
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => (root.dataset.input = 'pointer');
    const keyboard = (e: KeyboardEvent) => {
      // Esc closes what a click opened: it doesn't make the visitor a keyboard user.
      if (e.key === 'Escape' || e.metaKey || e.ctrlKey || e.altKey) return;
      root.dataset.input = 'keyboard';
    };
    addEventListener('pointerdown', pointer, true);
    addEventListener('keydown', keyboard, true);
    return () => {
      removeEventListener('pointerdown', pointer, true);
      removeEventListener('keydown', keyboard, true);
    };
  }, []);
  return (
    <nav aria-label="Sections" className="drawer">
      <p className="drawer__label">Sections</p>
      <ul className="drawer__list">
        {DESK_OBJECTS.map((o) => (
          <li key={o.slug}>
            <button
              type="button"
              className="drawer__button"
              data-slug={o.slug}
              aria-pressed={selected === o.slug}
              onClick={() => onOpen(o.slug)}
              onFocus={() => prefetchArt(o.id)}
            >
              {o.label}
            </button>
          </li>
        ))}
        {motion.ready && (
          <li className="drawer__motion">
            <button
              type="button"
              className="drawer__button"
              aria-pressed={motion.paused}
              onClick={motion.toggle}
            >
              Pause motion
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            className="drawer__button drawer__button--lamp"
            aria-pressed={lamp === 'on'}
            onClick={toggleLamp}
          >
            Lamp
          </button>
        </li>
      </ul>
    </nav>
  );
}
