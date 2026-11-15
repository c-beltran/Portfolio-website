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
  /** Text printed on the object's art (decorative; the drawer and panel carry the content). */
  face: readonly string[];
};

/** THE object registry: drawer, hotspots, scene, panels and routes all read it. */
export const DESK_OBJECTS: readonly DeskObject[] = [
  {
    id: 'photo',
    slug: 'about',
    label: 'About',
    ariaLabel: 'Polaroid photo: About me',
    metaFactId: 'F02',
    face: ['[TODO: Q13 photo]'],
  },
  {
    id: 'badge',
    slug: 'experience',
    label: 'Experience',
    ariaLabel: 'ID badge: Experience',
    metaFactId: 'F01',
    face: ['C. BELTRAN', 'Sr. Software Engineer', 'PEOPLE INC.', 'since July 2019'],
  },
  {
    id: 'laptop',
    slug: 'how-i-build',
    label: 'How I build',
    ariaLabel: 'Laptop: How I build',
    metaFactId: 'F11',
    face: [],
  },
  {
    id: 'gauge',
    slug: 'potaflow',
    label: 'Potaflow',
    ariaLabel: 'Backflow test kit gauge: Potaflow project',
    metaFactId: 'P01',
    face: [],
  },
  {
    id: 'phone',
    slug: 'power-walk',
    label: 'Power Walk',
    ariaLabel: 'Phone: Power Walk project',
    metaFactId: 'P04',
    face: [],
  },
  {
    id: 'note',
    slug: 'this-site',
    label: 'This site',
    ariaLabel: 'Sticky note: how this website was built',
    metaFactId: 'P06',
    face: ['this site:', 'built with', 'AI agents'],
  },
  {
    id: 'card',
    slug: 'contact',
    label: 'Contact',
    ariaLabel: 'Business card: Contact',
    metaFactId: 'F02',
    face: ['Carlos Beltran', 'Senior Software Engineer', 'linkedin · github'],
  },
];

export function objectBySlug(slug: string): DeskObject | undefined {
  return DESK_OBJECTS.find((o) => o.slug === slug);
}

/** The still desk's text alternative (spec §5): read by assistive tech in place of the art. */
export function deskDescription(): string {
  return `Carlos's desk, seen from above: ${DESK_OBJECTS.map((o) => o.ariaLabel).join('; ')}. Use the Sections buttons below to open each one.`;
}
