import type { FactId } from './facts';

/** Section routes, in drawer order (spec §2). */
export const SECTION_SLUGS = [
  'about',
  'experience',
  'how-i-build',
  'potaflow',
  'power-walk',
  'this-site',
  'contact',
] as const;

export type SectionSlug = (typeof SECTION_SLUGS)[number];

export type DeskObject = {
  id: 'photo' | 'badge' | 'laptop' | 'gauge' | 'phone' | 'note' | 'card';
  slug: SectionSlug;
  label: string;
  ariaLabel: string;
  /** The fact used for the route's meta description. */
  metaFactId: FactId;
};

/** THE object registry: drawer, hotspots, scene, panels and routes all read it. */
export const DESK_OBJECTS: readonly DeskObject[] = [
  {
    id: 'photo',
    slug: 'about',
    label: 'About',
    ariaLabel: 'Polaroid photo: About me',
    metaFactId: 'F02',
  },
  {
    id: 'badge',
    slug: 'experience',
    label: 'Experience',
    ariaLabel: 'ID badge: Experience',
    metaFactId: 'F01',
  },
  {
    id: 'laptop',
    slug: 'how-i-build',
    label: 'How I build',
    ariaLabel: 'Laptop: How I build',
    metaFactId: 'F11',
  },
  {
    id: 'gauge',
    slug: 'potaflow',
    label: 'Potaflow',
    ariaLabel: 'Backflow test kit gauge: Potaflow project',
    metaFactId: 'P01',
  },
  {
    id: 'phone',
    slug: 'power-walk',
    label: 'Power Walk',
    ariaLabel: 'Phone: Power Walk project',
    metaFactId: 'P04',
  },
  {
    id: 'note',
    slug: 'this-site',
    label: 'This site',
    ariaLabel: 'Sticky note: how this website was built',
    metaFactId: 'P06',
  },
  {
    id: 'card',
    slug: 'contact',
    label: 'Contact',
    ariaLabel: 'Business card: Contact',
    metaFactId: 'F02',
  },
];

export function objectBySlug(slug: string): DeskObject | undefined {
  return DESK_OBJECTS.find((o) => o.slug === slug);
}
