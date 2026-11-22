import type { FactId } from './facts';

/** Section routes, in drawer order. */
export const SECTION_SLUGS = [
  'cv',
  'about',
  'experience',
  'how-i-build',
  'potaflow',
  'power-walk',
  'this-site',
  'contact',
  // the room
  'cars',
  'soccer',
  'travel',
  'coffee',
] as const;

export type SectionSlug = (typeof SECTION_SLUGS)[number];

export type DeskObject = {
  id:
    | 'cv'
    | 'photo'
    | 'badge'
    | 'monitor'
    | 'kit'
    | 'phone'
    | 'notepad'
    | 'card'
    | 'car'
    | 'ball'
    | 'board'
    | 'mug';
  slug: SectionSlug;
  label: string;
  ariaLabel: string;
  /** The fact used for the route's meta description. */
  metaFactId: FactId;
};

/** THE object registry: drawer, hotspots, scene, panels and routes all read it. */
export const DESK_OBJECTS: readonly DeskObject[] = [
  {
    id: 'cv',
    slug: 'cv',
    label: 'CV',
    ariaLabel: 'Monitor, right screen: Carlos Beltran, CV',
    metaFactId: 'F01',
  },
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
    ariaLabel: 'Monitor, left screen: How I build',
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
  {
    id: 'car',
    slug: 'cars',
    label: 'Cars',
    ariaLabel: 'Scale-model Toyota beside the photo: Cars',
    metaFactId: 'H01',
  },
  {
    id: 'ball',
    slug: 'soccer',
    label: 'Soccer',
    ariaLabel: 'Soccer ball on the floor by the desk: Soccer',
    metaFactId: 'H03',
  },
  {
    id: 'board',
    slug: 'travel',
    label: 'Travel',
    ariaLabel: 'Magnet board of places on the wall: Travel',
    metaFactId: 'H04',
  },
  {
    id: 'mug',
    slug: 'coffee',
    label: 'Coffee',
    ariaLabel: 'Coffee mug by the mouse: Coffee',
    metaFactId: 'H06',
  },
];

export function objectBySlug(slug: string): DeskObject | undefined {
  return DESK_OBJECTS.find((o) => o.slug === slug);
}

/** The still desk's text alternative: read by assistive tech in place of the art. */
export function deskDescription(): string {
  return `Carlos's workspace: ${DESK_OBJECTS.map((o) => o.ariaLabel).join('; ')}. Use the Sections list (Tab) to open each one.`;
}
