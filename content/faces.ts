import { EDUCATION, renderFact, tenSecondFacts } from './facts';
import { headerSummary, LINKS, RESUME_TODO, showResume, showResumeTodo } from './links';

/**
 * The words on the faces of opened objects: the badge's back, the card's back, the two
 * monitor halves and the diploma once the view leans in. Real HTML laid on each render (OpenedFace.tsx); the panel
 * carries the same words, so the faces stay out of the Tab order.
 */
export const FACE_IDS = ['badge', 'card', 'monitor', 'cv', 'diploma'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export const NAME = 'Carlos Beltran';
export const TITLE = 'Senior Software Engineer';

export function badgeBack(): { heading: string; lines: string[]; todo: string } {
  return {
    heading: 'People Inc. · since July 2019',
    lines: [renderFact('F02'), renderFact('F01')],
    todo: '[TODO: Carlos: your earlier titles and the date of each change]',
  };
}

export function cardBack(): { links: { label: string; href: string }[]; todo?: string } {
  return {
    links: [
      ...(showResume() ? [{ label: 'Résumé', href: LINKS.resume }] : []),
      { label: 'LinkedIn', href: LINKS.linkedin },
      { label: 'GitHub', href: LINKS.github },
    ],
    ...(showResumeTodo() ? { todo: RESUME_TODO } : {}),
  };
}

export function cvScreen(): {
  name: string;
  title: string;
  summary: string;
  facts: string[];
  resume: { href: string } | { todo: string } | null;
  classic: string;
} {
  return {
    name: NAME,
    title: TITLE,
    summary: headerSummary(),
    facts: tenSecondFacts(),
    resume: showResume() ? { href: LINKS.resume } : showResumeTodo() ? { todo: RESUME_TODO } : null,
    classic: '/classic',
  };
}

export function buildScreen(): {
  spec: string;
  pr: string;
  checks: string[];
  checksTodo: string;
  session: string;
} {
  return {
    spec: '[TODO: Carlos: the spec to show]',
    pr: '[TODO: Carlos: the merged PR to show]',
    // This repo's own CI steps (.github/workflows/ci.yml).
    checks: [
      'Static checks and unit tests',
      'Build (preview env)',
      'End-to-end and accessibility tests',
      'Lighthouse CI',
    ],
    checksTodo: "[TODO: Carlos: a real run's checks (these stand in)]",
    session: '[TODO: Carlos: the session excerpt; you approve the exact text]',
  };
}

/** The diploma's paper, set as a diploma is: the college, its university, the degree, the field, the date. */
export function diplomaFace(): { lines: string[] } {
  const e = EDUCATION;
  return { lines: [e.college, e.system, e.degree, e.field, e.date] };
}
