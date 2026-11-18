import { describe, expect, it } from 'vitest';
import { facts, RETIRED_FACT_IDS, type FactId } from './facts';
import { deskDescription, DESK_OBJECTS, objectBySlug, SECTION_SLUGS } from './objects';
import { PANELS, type PanelBlock } from './panels';
import statsJson from './stats.json';
import type { Stats } from './stats.types';

const liveIds = new Set(Object.keys(facts));
const allBlocks: PanelBlock[] = Object.values(PANELS).flat();

function idsOf(block: PanelBlock): string[] {
  if (block.kind === 'prose' || block.kind === 'list') return block.facts;
  if (block.kind === 'fact') return [block.fact];
  return [];
}

function textOf(block: PanelBlock): string {
  switch (block.kind) {
    case 'eyebrow':
    case 'title':
    case 'prose':
    case 'todo':
      return block.text;
    case 'link':
      return `${block.label} ${block.href ?? ''}`;
    case 'links':
      return '';
    case 'stats':
      return block.items.map((i) => `${i.label} ${i.value(statsJson as Stats)}`).join(' ');
    default:
      return '';
  }
}

describe('panels', () => {
  it('every prose block cites at least one live fact', () => {
    for (const b of allBlocks.filter((b) => b.kind === 'prose')) {
      expect(idsOf(b).length).toBeGreaterThanOrEqual(1);
      for (const id of idsOf(b)) expect(liveIds.has(id)).toBe(true);
    }
  });

  it('every cited fact is live and none is retired', () => {
    for (const id of allBlocks.flatMap(idsOf)) {
      expect(liveIds.has(id as FactId)).toBe(true);
      expect(RETIRED_FACT_IDS as readonly string[]).not.toContain(id);
    }
  });

  it('every section has a panel', () => {
    for (const slug of SECTION_SLUGS) expect(PANELS[slug]?.length).toBeGreaterThan(0);
  });

  it('contains no email, town name, vendor claim or "licensed"', () => {
    for (const text of allBlocks.map(textOf)) {
      expect(text).not.toContain('@');
      expect(text).not.toMatch(/Hempstead|vendor|licensed/i);
    }
  });
});

describe('claims (checkpoint 2)', () => {
  // Q24 (2026-11-17) confirmed "I write the spec" and "Nothing merges until I've read it".
  const UNBACKED = /I wrote|I review|I reviewed|tool of mine|licensed/i;

  it('makes no authorship or review claim the stats cannot back', () => {
    for (const b of allBlocks) {
      if (b.kind === 'prose') expect(b.text.replace(/\[TODO:[^\]]*\]/g, '')).not.toMatch(UNBACKED);
    }
  });

  it('every title is marked as draft copy', () => {
    for (const b of allBlocks.filter((b) => b.kind === 'title')) {
      expect(b).toMatchObject({ draft: true });
    }
  });

  it('a link without a URL always carries a visible TODO', () => {
    for (const b of allBlocks) {
      if (b.kind === 'link' && b.href === null) expect(b.todo).toMatch(/^Q\d+/);
    }
  });

  it('the contact panel renders the contact links block', () => {
    expect(PANELS.contact.some((b) => b.kind === 'links')).toBe(true);
  });

  it('the about prose cites the ad-performance fact it paraphrases', () => {
    const prose = PANELS.about.find((b) => b.kind === 'prose');
    expect(prose && idsOf(prose)).toContain('F07');
  });
});

describe('objects', () => {
  it('drawer order matches the section order', () => {
    expect(DESK_OBJECTS.map((o) => o.slug)).toEqual([...SECTION_SLUGS]);
  });

  it('looks objects up by slug', () => {
    expect(objectBySlug('potaflow')?.id).toBe('gauge');
    expect(objectBySlug('nope')).toBeUndefined();
  });

  it('every object points its metadata at a live fact', () => {
    for (const o of DESK_OBJECTS) expect(liveIds.has(o.metaFactId)).toBe(true);
  });
});

describe('desk object faces', () => {
  const lines = DESK_OBJECTS.flatMap((o) => o.face);

  it('shows no digits except the badge year', () => {
    // TODO markers carry question numbers (Q13), which aren't stats.
    const text = (l: string) => l.replace(/\[TODO: Q\d+[^\]]*\]/g, '');
    expect(lines.filter((l) => /\d/.test(text(l)) && l !== 'since July 2019')).toEqual([]);
  });

  it.each(['@', 'Hempstead', 'reviewed'])('never says %s', (word) => {
    expect(lines.filter((l) => l.toLowerCase().includes(word.toLowerCase()))).toEqual([]);
  });

  it('describes every object for assistive tech', () => {
    const d = deskDescription();
    DESK_OBJECTS.forEach((o) => expect(d).toContain(o.ariaLabel));
  });
});

describe('answered questions (Q3, Q7, Q24, Q26)', () => {
  const text = (slug: keyof typeof PANELS) => PANELS[slug].map(textOf).join(' ');
  const all = Object.keys(PANELS)
    .map((k) => text(k as keyof typeof PANELS))
    .join(' ');

  it('makes no backflow credential claim and leaves no Q3 or Q24 TODO', () => {
    expect(all).not.toMatch(/TODO: Q3|TODO: Q24|licensed|credential/i);
  });

  it('restores the two confirmed claims on How I build', () => {
    expect(text('how-i-build')).toContain('I write the spec');
    expect(text('how-i-build')).toContain("Nothing merges until I've read it");
  });

  it('never claims Carlos reviewed everything', () => {
    expect(all).not.toMatch(/reviewed everything|review every change/i);
  });

  it('links Potaflow to potaflow.com', () => {
    const link = PANELS.potaflow.find((b) => b.kind === 'link');
    expect(link && 'href' in link && link.href).toBe('https://potaflow.com');
  });

  it('marks Power Walk as in development, not public (Q26)', () => {
    expect(text('power-walk')).toContain('TODO: Q26');
    expect(text('power-walk')).not.toContain('TODO: Q7 confirm public name');
  });
});
