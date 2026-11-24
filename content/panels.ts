import type { FactId } from './facts';
import type { SectionSlug } from './objects';
import type { Stats } from './stats.types';

/** Every prose block is a draft until Carlos rewrites it in his own voice. */
export const DRAFT_MARK = '[DRAFT: Carlos to rewrite]';

export type PanelBlock =
  | { kind: 'eyebrow'; text: string }
  | { kind: 'title'; text: string; draft: true }
  | { kind: 'prose'; facts: FactId[]; text: string; draft: true }
  | { kind: 'fact'; fact: FactId }
  | { kind: 'list'; facts: FactId[] }
  | { kind: 'stats'; items: { label: string; value: (s: Stats) => string }[] }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'link'; href: null; label: string; todo: string }
  /** Résumé (when shown), LinkedIn and GitHub, from content/links.ts. */
  | { kind: 'links' }
  /** The header's content, on the monitor's CV page: summary, ten-second facts, résumé, Classic. */
  | { kind: 'cv' }
  /** Pause/Play for the phone's clip (WCAG 2.2.2), components/panel/ClipControl.tsx. */
  | { kind: 'clip' }
  /** The places Carlos has traveled to (facts.PLACES), as a list, citing the travel fact. */
  | { kind: 'places'; fact: FactId }
  | { kind: 'todo'; text: string };

const n = (value: number) => value.toLocaleString('en-US');

/** Panel copy. */
export const PANELS: Record<SectionSlug, PanelBlock[]> = {
  cv: [
    { kind: 'eyebrow', text: 'THE MONITOR · CV' },
    { kind: 'title', text: 'The short version', draft: true },
    { kind: 'cv' },
  ],
  about: [
    { kind: 'eyebrow', text: 'THE PHOTO · ABOUT' },
    { kind: 'title', text: "Hi, I'm Carlos.", draft: true },
    { kind: 'fact', fact: 'ABOUT' },
    {
      kind: 'prose',
      facts: ['F02', 'F07', 'P01'],
      text: 'Weekdays, I make an ad platform faster. I also build Potaflow.',
      draft: true,
    },
    { kind: 'todo', text: '[TODO: Carlos: your framed photo (the print is a placeholder)]' },
  ],
  experience: [
    { kind: 'eyebrow', text: 'THE BADGE · EXPERIENCE' },
    { kind: 'title', text: 'Same desk since July 2019', draft: true },
    {
      kind: 'prose',
      facts: ['F02', 'F01'],
      text: 'Senior Software Engineer, Performance Engineering on the Ad Platform. One company, three names: Meredith, then Dotdash Meredith, now People Inc.',
      draft: true,
    },
    { kind: 'list', facts: ['F03', 'F04', 'F06', 'F07', 'F08'] },
  ],
  'how-i-build': [
    { kind: 'eyebrow', text: 'THE MONITOR · HOW I BUILD' },
    { kind: 'title', text: 'I set the bar. Agents do the legwork.', draft: true },
    {
      kind: 'prose',
      facts: ['F11'],
      text: "I write the spec. Agents plan, build and review in parallel. Nothing merges until I've read it.",
      draft: true,
    },
    { kind: 'list', facts: ['F11', 'F09', 'F10'] },
  ],
  potaflow: [
    { kind: 'eyebrow', text: 'THE KIT CASE · PROJECT 01' },
    { kind: 'title', text: 'Potaflow', draft: true },
    { kind: 'fact', fact: 'P01' },
    {
      kind: 'prose',
      facts: ['P03'],
      text: 'Custom skills give the agents the rules: NY DOH-1013 and how each device is physically tested.',
      draft: true,
    },
    {
      kind: 'stats',
      items: [
        { label: 'Commits', value: (s) => n(s.potaflow.commits) },
        { label: 'Co-authored with Claude', value: (s) => `${s.potaflow.coAuthoredPercent}%` },
        { label: 'Merged PRs', value: (s) => n(s.potaflow.mergedPRs) },
        { label: 'People', value: () => '1 human + agents' },
      ],
    },
    { kind: 'fact', fact: 'P02' },
    { kind: 'link', href: 'https://potaflow.com', label: 'Visit potaflow.com' },
    { kind: 'todo', text: '[TODO: Potaflow screenshot from Carlos]' },
  ],
  'power-walk': [
    { kind: 'eyebrow', text: 'THE PHONE · PROJECT 02' },
    { kind: 'title', text: 'Power Walk', draft: true },
    { kind: 'clip' },
    {
      kind: 'todo',
      text: '[TODO: Power Walk screen recording from Carlos (the clip is a placeholder)]',
    },
    { kind: 'todo', text: '[TODO: in development, not public yet: landing page to decide]' },
    { kind: 'fact', fact: 'P04' },
    {
      kind: 'prose',
      facts: ['P05'],
      text: 'Spec first: I write the specs and plans, and agents build against them.',
      draft: true,
    },
    { kind: 'fact', fact: 'P05' },
    { kind: 'todo', text: '[TODO: in-development badge + screenshot from Carlos]' },
  ],
  'this-site': [
    { kind: 'eyebrow', text: 'THE NOTEPAD · PROJECT 03' },
    { kind: 'title', text: 'This website', draft: true },
    { kind: 'fact', fact: 'P06' },
    {
      kind: 'prose',
      facts: ['P06'],
      text: 'Designed on a Claude Design canvas and built with agents.',
      draft: true,
    },
    {
      kind: 'stats',
      items: [
        { label: 'Commits', value: (s) => n(s.thisSite.commits) },
        { label: 'Merged PRs', value: (s) => n(s.thisSite.mergedPRs) },
      ],
    },
    {
      kind: 'prose',
      facts: ['P06'],
      text: "The window shows the weather where you are: your browser asks Open-Meteo for the current weather in your time zone's main city. Open-Meteo sees your IP address, as any site you load does, and never your location.",
      draft: true,
    },
    {
      kind: 'link',
      href: 'https://open-meteo.com/',
      label: 'Weather data by Open-Meteo.com (CC BY 4.0)',
    },
    { kind: 'todo', text: '[TODO: direction thumbnails]' },
    {
      kind: 'todo',
      text: '[TODO: Carlos: your sketches of the desk (the notepad shows placeholders)]',
    },
  ],
  contact: [
    { kind: 'eyebrow', text: 'THE CARD · CONTACT' },
    { kind: 'title', text: 'Say hello', draft: true },
    { kind: 'links' },
  ],
  // The room: drafted only from Carlos's own words.
  cars: [
    { kind: 'eyebrow', text: 'THE MODEL CAR · CARS' },
    { kind: 'title', text: 'I like to work on cars', draft: true },
    {
      kind: 'prose',
      facts: ['H01', 'H02'],
      text: 'Diagnosing them is one of my hobbies. I worked as a tech at Start Toyota of Bayside.',
      draft: true,
    },
    { kind: 'list', facts: ['H01', 'H02'] },
    { kind: 'todo', text: '[TODO: Carlos: your role and dates at Start Toyota of Bayside]' },
  ],
  soccer: [
    { kind: 'eyebrow', text: 'THE BALL · SOCCER' },
    { kind: 'title', text: 'Soccer is my favorite sport', draft: true },
    {
      kind: 'prose',
      facts: ['H03'],
      text: 'I played on my high school team, and I still play with friends.',
      draft: true,
    },
    {
      kind: 'todo',
      text: '[TODO: Carlos: anything to add, such as your position or where you play now]',
    },
  ],
  travel: [
    { kind: 'eyebrow', text: 'THE MAGNET BOARD · TRAVEL' },
    { kind: 'title', text: 'Places I have been', draft: true },
    {
      kind: 'prose',
      facts: ['H05'],
      text: 'The magnet in the middle is home: El Salvador, where my roots are.',
      draft: true,
    },
    { kind: 'places', fact: 'H04' },
    { kind: 'todo', text: '[TODO: Carlos: a line about travel in your own words]' },
  ],
  coffee: [
    { kind: 'eyebrow', text: 'THE MUG · COFFEE' },
    { kind: 'title', text: "I'm a coffee addict", draft: true },
    { kind: 'todo', text: '[TODO: Carlos: anything to add, such as how you take it]' },
  ],
};
