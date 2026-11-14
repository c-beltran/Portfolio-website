import { DESK_OBJECTS, type SectionSlug } from '@/content/objects';

type Props = {
  selected: SectionSlug | null;
  onOpen: (slug: SectionSlug, trigger: HTMLElement) => void;
};

/** Every desk object mirrored as a real button (spec §3.4). */
export function Drawer({ selected, onOpen }: Props) {
  return (
    <nav aria-label="Sections" className="drawer">
      <p className="drawer__label">Or open a drawer:</p>
      <ul className="drawer__list">
        {DESK_OBJECTS.map((o) => (
          <li key={o.slug}>
            <button
              type="button"
              className="drawer__button"
              aria-pressed={selected === o.slug}
              onClick={(e) => onOpen(o.slug, e.currentTarget)}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
