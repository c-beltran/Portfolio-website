import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderFact, tenSecondFacts } from './facts';
import {
  FACE_IDS,
  NAME,
  TITLE,
  badgeBack,
  buildScreen,
  cardBack,
  cvScreen,
  diplomaFace,
} from './faces';
import { LINKS } from './links';

describe('faces', () => {
  it('are on the badge, the card, the two monitor halves and the diploma', () => {
    expect(FACE_IDS).toEqual(['badge', 'card', 'monitor', 'cv', 'diploma']);
    expect([NAME, TITLE]).toEqual(['Carlos Beltran', 'Senior Software Engineer']);
  });

  it("the badge's back: the role, then the company, then a TODO for the earlier titles", () => {
    const b = badgeBack();
    expect(b.heading).toBe('People Inc. · since July 2019');
    expect(b.lines).toEqual([renderFact('F02'), renderFact('F01')]);
    expect(b.todo).toMatch(/^\[TODO: Carlos: /);
  });

  it("the card's back links to LinkedIn and GitHub, and never to an email", () => {
    const c = cardBack();
    const hrefs = c.links.map((l) => l.href);
    expect(hrefs).toEqual(expect.arrayContaining([LINKS.linkedin, LINKS.github]));
    expect(hrefs.every((h) => (Object.values(LINKS) as string[]).includes(h))).toBe(true);
    expect(JSON.stringify(c)).not.toMatch(/mailto:|@/);
  });

  it("the CV screen carries the header's ten-second facts and the Classic version", () => {
    const s = cvScreen();
    expect(s.facts).toEqual(tenSecondFacts());
    expect([s.name, s.title, s.classic]).toEqual([NAME, TITLE, '/classic']);
  });

  it("How I build's checks are this repo's own CI steps, marked as a stand-in", () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    const steps = [...ci.matchAll(/- name: (.+)/g)].map((m) => m[1]!);
    const b = buildScreen();
    expect(b.checks).toHaveLength(4);
    for (const c of b.checks) expect(steps.some((s) => s.startsWith(c))).toBe(true);
    for (const t of [b.spec, b.pr, b.session, b.checksTodo]) expect(t).toMatch(/^\[TODO: /);
  });
});

describe('the diploma', () => {
  it('carries the degree, in diploma order', () => {
    expect(diplomaFace().lines).toEqual([
      'Queens College',
      'The City University of New York',
      'Bachelor of Science',
      'Computer Science',
      'May 2019',
    ]);
  });
});
