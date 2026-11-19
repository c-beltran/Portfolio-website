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
  id: 'photo' | 'badge' | 'monitor' | 'kit' | 'phone' | 'notepad' | 'card';
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
    ariaLabel: 'Small framed photo: About me',
    metaFactId: 'F02',
  },
  {
    id: 'badge',
    slug: 'experience',
    label: 'Experience',
    ariaLabel: 'ID badge on its lanyard: Experience',
    metaFactId: 'F01',
  },
  {
    id: 'monitor',
    slug: 'how-i-build',
    label: 'How I build',
    ariaLabel: 'Ultrawide monitor: How I build',
    metaFactId: 'F11',
  },
  {
    id: 'kit',
    slug: 'potaflow',
    label: 'Potaflow',
    ariaLabel: 'Backflow test-kit case: Potaflow project',
    metaFactId: 'P01',
  },
  {
    id: 'phone',
    slug: 'power-walk',
    label: 'Power Walk',
    ariaLabel: 'Phone, face up on the mat: Power Walk project',
    metaFactId: 'P04',
  },
  {
    id: 'notepad',
    slug: 'this-site',
    label: 'This site',
    ariaLabel: 'Notepad and pen: how this website was built',
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

/** The still desk's text alternative (spec §5): read by assistive tech in place of the art. */
export function deskDescription(): string {
  return `Carlos's workspace: ${DESK_OBJECTS.map((o) => o.ariaLabel).join('; ')}. Use the Sections buttons below to open each one.`;
}
