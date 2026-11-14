import type { FactId } from './facts';
import type { SectionSlug } from './objects';
import type { Stats } from './stats.types';

/** Every prose block is a draft until Carlos rewrites it in his own voice (spec §5). */
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
  | { kind: 'todo'; text: string };

const n = (value: number) => value.toLocaleString('en-US');

/** Panel copy, ported from the approved mock with the M0 decisions applied. */
export const PANELS: Record<SectionSlug, PanelBlock[]> = {
  about: [
    { kind: 'eyebrow', text: 'THE PHOTO · ABOUT' },
    { kind: 'title', text: "Hi, I'm Carlos.", draft: true },
    { kind: 'fact', fact: 'ABOUT' },
    {
      kind: 'prose',
      facts: ['F02', 'F07'],
      text: "Weekdays, I make an ad platform faster. Weekends, [TODO: Q3 backflow credential]. That's how Potaflow happened.",
      draft: true,
    },
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
    { kind: 'eyebrow', text: 'THE LAPTOP · HOW I BUILD' },
    { kind: 'title', text: 'I set the bar. Agents do the legwork.', draft: true },
    {
      kind: 'prose',
      facts: ['F11'],
      text: 'Agents plan, build and review in parallel. [TODO: Q24 confirm: "I write the spec" and "Nothing merges until I\'ve read it"]',
      draft: true,
    },
    { kind: 'list', facts: ['F11', 'F09', 'F10'] },
  ],
  potaflow: [
    { kind: 'eyebrow', text: 'THE GAUGE · PROJECT 01' },
    { kind: 'title', text: 'Potaflow', draft: true },
    { kind: 'fact', fact: 'P01' },
    {
      kind: 'prose',
      facts: ['P03'],
      text: '[TODO: Q3 backflow credential, and whether the gauge is his own tool] Custom skills give the agents the rules: NY DOH-1013 and how each device is physically tested. [TODO: Q24 confirm review claim]',
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
    { kind: 'link', href: null, label: 'Visit potaflow.com', todo: 'Q7' },
    { kind: 'todo', text: '[TODO: Q7 Potaflow screenshot]' },
  ],
  'power-walk': [
    { kind: 'eyebrow', text: 'THE PHONE · PROJECT 02' },
    { kind: 'title', text: 'Power Walk', draft: true },
    { kind: 'todo', text: '[TODO: Q7 confirm public name]' },
    { kind: 'fact', fact: 'P04' },
    {
      kind: 'prose',
      facts: ['P05'],
      text: 'Spec first: agents built against written specs and plans. [TODO: Q24 confirm: who wrote the specs, and the review claim]',
      draft: true,
    },
    { kind: 'fact', fact: 'P05' },
    { kind: 'todo', text: '[TODO: Q7 Coming soon badge + screenshot]' },
  ],
  'this-site': [
    { kind: 'eyebrow', text: 'THE NOTE · PROJECT 03' },
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
    { kind: 'todo', text: '[TODO: Q21 direction thumbnails]' },
  ],
  contact: [
    { kind: 'eyebrow', text: 'THE CARD · CONTACT' },
    { kind: 'title', text: 'Say hello', draft: true },
    { kind: 'links' },
  ],
};
